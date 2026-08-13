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
    const authenticatedUserId = req.user?.userId;
    const isRoleManager = req.user?.role;

    if (!authenticatedUserId || isRoleManager?.toLowerCase() !== "manager") {
      return next(
        new ApiError(401, "Unauthenticated user or unauthorized role"),
      );
    }

    if (!userId || !role || !status) {
      return next(
        new ApiError(400, "userId, role, and status fields are required"),
      );
    }

    const managerRes = await pool.query(
      `SELECT manager_id FROM manager WHERE user_id = $1;`,
      [authenticatedUserId],
    );
    const actualManagerId = managerRes.rows[0]?.manager_id;

    if (!actualManagerId) {
      return next(
        new ApiError(404, "Manager record not found in manager table"),
      );
    }

    const normalizedRole = role.toLowerCase().trim();
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

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const dbResult = await client.query(
        `
        UPDATE ${tableName} 
        SET request_status = $1, 
            requested_garden_manager_id = $2,
            updated_at = NOW()
        WHERE user_id = $3
        RETURNING *;
        `,
        [normalizeStatus, actualManagerId, userId],
      );

      const queryData = dbResult.rows[0];

      if (!queryData) {
        await client.query("ROLLBACK");
        return next(
          new ApiError(
            404,
            `No ${normalizedRole} record found for user_id ${userId}`,
          ),
        );
      }

      let assignmentsCreated: Array<{ driver_id: number; stg_id: number }> = [];

      if (normalizeStatus === "ACCEPTED") {
        if (normalizedRole === "stg") {
          const dbQuery = await client.query(
            `
            WITH nearest_driver AS (
              SELECT d.driver_id
              FROM driver d
              JOIN users u_driver ON d.user_id = u_driver.user_id
              CROSS JOIN (
                SELECT u_stg.location 
                FROM stg s 
                JOIN users u_stg ON s.user_id = u_stg.user_id 
                WHERE s.user_id = $1
              ) AS target_stg
              LEFT JOIN driver_stg_assignments dsa 
                ON d.driver_id = dsa.driver_id AND dsa.status = 'ACTIVE'
              WHERE d.requested_garden_manager_id = $2
                AND d.request_status = 'ACCEPTED'
                AND d.doc_verification_status = 'VERIFIED'
                AND ST_DWithin(
                  u_driver.location::geography, 
                  target_stg.location::geography, 
                  10000
                )
              GROUP BY d.driver_id, u_driver.location, target_stg.location
              HAVING COUNT(dsa.assignment_id) < 5
              ORDER BY ST_Distance(u_driver.location::geography, target_stg.location::geography) ASC
              LIMIT 1
            )
            INSERT INTO driver_stg_assignments (driver_id, stg_id, manager_id, status)
            SELECT nad.driver_id, s.stg_id, $2, 'ACTIVE'
            FROM nearest_driver nad
            CROSS JOIN stg s 
            WHERE s.user_id = $1
            RETURNING driver_id, stg_id;
            `,
            [userId, actualManagerId], 
          );

          assignmentsCreated = dbQuery.rows;
        } else if (normalizedRole === "driver") {
          const dbQuery = await client.query(
            `
            WITH unassigned_stgs AS (
              SELECT s.stg_id 
              FROM stg s
              JOIN users u_stg ON s.user_id = u_stg.user_id
              CROSS JOIN (
                SELECT u_drv.location 
                FROM driver d
                JOIN users u_drv ON d.user_id = u_drv.user_id
                WHERE d.user_id = $1
              ) AS target_driver
              LEFT JOIN driver_stg_assignments dsa 
                ON s.stg_id = dsa.stg_id AND dsa.status = 'ACTIVE'
              WHERE s.requested_garden_manager_id = $2
                AND s.request_status = 'ACCEPTED'
                AND s.doc_verification_status = 'VERIFIED'
                AND dsa.assignment_id IS NULL
                AND ST_DWithin(
                  u_stg.location::geography, 
                  target_driver.location::geography, 
                  10000
                )
              ORDER BY ST_Distance(u_stg.location::geography, target_driver.location::geography) ASC
              LIMIT 5
            )
            INSERT INTO driver_stg_assignments (driver_id, stg_id, manager_id, status)
            SELECT d.driver_id, us.stg_id, $2, 'ACTIVE'
            FROM unassigned_stgs us
            CROSS JOIN driver d WHERE d.user_id = $1
            RETURNING driver_id, stg_id;
            `,
            [userId, actualManagerId],
          );

          assignmentsCreated = dbQuery.rows;
        }
      }

      await client.query("COMMIT");

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { record: queryData, assignmentsCreated },
            `Request status updated to ${normalizeStatus} successfully`,
          ),
        );
    } catch (error) {
      await client.query("ROLLBACK");
      return next(
        new ApiError(500, "Error while updating request status", error as any),
      );
    } finally {
      client.release();
    }
  },
);