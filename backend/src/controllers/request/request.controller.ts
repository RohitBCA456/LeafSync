import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../utilities/asyncHandler.util.js";
import { ApiError } from "../../utilities/ApiError.util.js";
import { redisClient } from "../../config/redis.config.js";
import { pool } from "../../config/db.config.js";
import { ApiResponse } from "../../utilities/ApiResponse.js";
import { role } from "../../types/auth.type.js";

type FactoryResponse = {
  manager_id: number;
  manager_name: string;
  ph_number: string;
  latitude: number;
  longitude: number;
  distance_km: number;
};

export const listOfAllNearByFactories = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return next(new ApiError(401, "User is not authenticated"));
    }

    if (userRole !== "driver" && userRole !== "stg") {
      return next(
        new ApiError(
          403,
          "Only Drivers and STGs can search for nearby factories",
        ),
      );
    }

    const tableName = userRole === "driver" ? "driver" : "stg";

    const verificationQuery = await pool.query(
      `SELECT doc_verification_status FROM ${tableName} WHERE user_id = $1;`,
      [userId],
    );

    const userRecord = verificationQuery.rows[0];

    if (!userRecord || userRecord.doc_verification_status !== "VERIFIED") {
      return next(
        new ApiError(403, "User must be verified to make this request"),
      );
    }

    const cacheKey = `nearby_factories:${userId}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      try {
        const factories: FactoryResponse[] = JSON.parse(cachedData);
        return res
          .status(200)
          .json(
            new ApiResponse(
              200,
              factories,
              "Nearby factories retrieved from cache successfully",
            ),
          );
      } catch (err) {
        return next(
          new ApiError(500, "error while fetching data from redis", err as any),
        );
      }
    }

    const query = `
      SELECT 
        m.user_id AS manager_id,
        u.name AS manager_name,
        u.ph_number,
        ST_Y(u.location::geometry) AS latitude,
        ST_X(u.location::geometry) AS longitude,
        ROUND(
          (ST_Distance(u.location::geography, target.location::geography) / 1000)::numeric, 
          2
        ) AS distance_km
      FROM manager m 
      JOIN users u ON m.user_id = u.user_id
      CROSS JOIN (
        SELECT location
        FROM users
        WHERE user_id = $1
      ) AS target
      WHERE doc_verification_status = 'VERIFIED'
      AND ST_DWithin(
        u.location::geography,
        target.location::geography,
        10000 
      )
      ORDER BY distance_km ASC;
    `;

    const result = await pool.query(query, [userId]);
    const factories: FactoryResponse[] = result.rows;

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(factories));

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          factories,
          "Nearby factories retrieved successfully",
        ),
      );
  },
);

type StatusUpdateRequest = {
  userId: number;
  role: role;
  status: "ACCEPTED" | "REJECTED";
};

export const updateRequestStatus = asyncHandler(
  async (
    req: Request<{}, {}, StatusUpdateRequest>,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const { userId, role, status } = req.body;
    const manager_user_id = req.user?.userId;
    const isRoleManager = req.user?.role;

    if (!manager_user_id || isRoleManager?.toLocaleLowerCase() !== "manager") {
      return next(new ApiError(401, "unauthenticated user"));
    }

    if (!userId || !role || !status) {
      return next(
        new ApiError(400, "userId, role and status field is missing"),
      );
    }

    const normalizedRole = role.toLocaleLowerCase().trim();
    if (!["stg", "driver"].includes(normalizedRole)) {
      return next(
        new ApiError(
          400,
          "Invalid role. Role must be either 'stg' or 'driver'",
        ),
      );
    }

    const normalizeStatus = status.toUpperCase().trim();
    if (!["ACCEPTED", "REJECTED"].includes(normalizeStatus)) {
      return next(
        new ApiError(
          400,
          "Invalid status type. Allowed: 'ACCEPTED', 'REJECTED'",
        ),
      );
    }

    const tableName = normalizedRole === "driver" ? "driver" : "stg";

    const managerData = await pool.query(
      `
      SELECT manager_id FROM manager WHERE user_id = $1;
      `,
      [manager_user_id],
    );

    let manager_id = null;
    if (managerData) {
      manager_id = managerData.rows[0].manager_id;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const dbResult = await client.query(
        `
      UPDATE ${tableName} SET request_status = $1, 
      requested_garden_manager_id = $2,
      updated_at = NOW()
      WHERE user_id = $3
      RETURNING *;
      `,
        [status.toUpperCase(), manager_id, userId],
      );

      const queryData = dbResult.rows[0];

      if (!queryData) {
        await client.query("ROLLBACK");
        return next(
          new ApiError(404, `no ${normalizedRole} found for user_id ${userId}`),
        );
      }

      let assignedDriver = null;

      if (normalizeStatus === "ACCEPTED" && normalizedRole === "stg") {
        const dbQuery = await client.query(
          `
            WITH target_stg AS (
            SELECT location FROM users
            WHERE user_id = $1
            ),
            nearest_driver AS (
            SELECT u.location, 
            d.driver_id,
            ST_Distance(u.location::geography, t.location::geography) AS distance_meters
            FROM driver d
            JOIN users u ON d.user_id = u.user_id
            CROSS JOIN target_stg t
            WHERE d.doc_verification_status = 'VERIFIED' AND
            d.requested_garden_manager_id = $2 AND
            ST_DWithin(u.location::geography, t.location::geography, 10000)
            )
            SELECT * FROM nearest_driver
            ORDER BY distance_meters ASC
            LIMIT 1
            `,
          [userId, manager_id],
        );

        assignedDriver = dbQuery.rows[0];
        if (assignedDriver) {
          await client.query(
            `
            INSERT INTO driver_stg_assignments(driver_id, stg_id, manager_id, distance, status)
            VALUES($1, $2, $3, $4, 'ACTIVE')
            `,
            [
              assignedDriver.driver_id,
              queryData.stg_id,
              manager_id,
              assignedDriver.distance_meters,
            ],
          );
        }
      }

      await client.query("COMMIT");
      return res.status(201).json(
        new ApiResponse(
          201,
          {
            queryData,
            assignedDriver,
          },
          "assigned driver to stg successfully",
        ),
      );
    } catch (error) {
      await client.query("ROLLBACK");
      return next(
        new ApiError(
          500,
          "internal server error while updating request status",
          error as any,
        ),
      );
    } finally {
      client.release();
    }
  },
);
