import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from './db/index.js';

const app  = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true , limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


//routes import

import userRouter from './routes/user.routes.js'



//routes declaration
app.use("/api/v1/users",userRouter)




export { app }