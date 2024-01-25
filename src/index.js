import dotenv from "dotenv";
import connectDb from "./db/index.js";
//when mentioning path inside the config plz put path with utmost care
dotenv.config();
connectDb();

/*
import express from "express";
const app = express()
(aync () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(error)=>{
            console.log("error",error);
            throw error
        })
    }catch(error){
        console.log("Error",error);
        throw err
    }
})();
*/
