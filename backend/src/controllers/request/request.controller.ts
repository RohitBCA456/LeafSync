import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../utilities/asyncHandler.util.js";
import { ApiError } from "../../utilities/ApiError.util.js";
import { redisClient } from "../../config/redis.config.js";
import { pool } from "../../config/db.config.js";
import { ApiResponse } from "../../utilities/ApiResponse.js";

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
