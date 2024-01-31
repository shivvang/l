import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/users.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  //register user details from frontend
  //validation not empty
  //check if user already exists:username ,email
  //check for images,check for avatar
  //upload them to cloudinary ,avatar
  //create user object - create entry in db
  //remove password and refresh token field from response
  //check for user creation
  //return res

  //parsing data from frotend
  const { fullName, email, userName, password } = req.body;
  console.log("email", email);

  //check whether data has value and is not empty
  // for each element in array it checks if they are empty or not if true then error message is logged
  if (
    [fullName, email, userName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //check whether user already exist or not
  //{} in findone define query
  //database exist in different contnient there fore await was required
  const existedUser = await User.findOne({ $or: [{ email }, { userName }] });

  if (existedUser) {
    throw new ApiError(400, "user with username or email already exist");
  }

  //check for images,check for avatar
  //since multer as middleware is used before calling controller we get to have access to file

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file path is requierd");
  }

  //upload them to cloudinary ,avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  //check if file upload is done or not because it is required field  db will definately break
  if (!avatar) {
    throw new ApiError(400, "Avatar file is requierd");
  }

  //create user object - create entry in db
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  });
  //check whether user created or not
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  //remove password and refresh token field from response

  //check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went Wrong while Registering User");
  }

  //return res
  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

export { registerUser };
