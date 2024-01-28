import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
  })
);

app.use(express.json({ limit: "16kb" }));

app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(express.static("public"));

app.use(cookieParser());
export { app };

//import routes
import userRouter from "./routes/user.routes.js";

//control is given to userRouter when /users path is hit by client
app.use("/api/v1/users", userRouter);

//this how they define path in industry
//https://localhost:8000/api/v1/users/other methods
