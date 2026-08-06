import { Router } from "express";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import { listOfAllNearByFactories } from "../../controllers/request/request.controller.js";

const router = Router();

router.route("/list-nearby-factories").get(verifyJWT, listOfAllNearByFactories);

export { router as requestRouter };
