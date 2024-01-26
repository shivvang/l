import dotenv from "dotenv";
import connectDb from "./db/index.js";
import { app } from "./app.js";
//when mentioning path inside the config plz put path with utmost care
dotenv.config();
connectDb()
  .then(() => {
    app.on("error", (err) => {
      console.log("errr", err);
      throw err;
    });
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running at port : ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log("mongo db connection failed !!", err);
  });

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
