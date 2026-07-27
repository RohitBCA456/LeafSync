import { Router } from "express";
import { register } from "../controllers/auth/stg.auth.controller";

const router = Router();

router.route("/register").post(register);