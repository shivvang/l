import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/users.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Jwt from "jsonwebtoken";
import mongoose from "mongoose";
const generaterAccessAndRefereshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    //method
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    //updating user refresh token field with newly generated token
    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating acces and refresh token"
    );
  }
};

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
  //console.log("email", email);

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
  // let coverImageLocalPath;

  // if (
  //   req.files &&
  //   Array.isArray(req.files.coverImage) &&
  //   req.files.coverImage.length > 0
  // )
  // coverImage = req.files.coverImage[0].path;

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

const loginUser = asyncHandler(async (req, res) => {
  //parsing data from fronted
  const { userName, email, password } = req.body;
  //check for username or email existance
  if (!(userName || email))
    throw new ApiError(400, "username or email is required");

  //check for user in database
  const user = await User.findOne({ $or: [{ userName }, { email }] });

  //user doesnt exist
  if (!user) throw new ApiError(404, "user does not exist");

  //password validation
  const passwordValidation = await user.isPasswordCorrect(password);
  //password wrong cheack
  if (!passwordValidation) throw new ApiError(401, "invalid user credentials");

  //accessa and refresh token
  const { accessToken, refreshToken } = await generaterAccessAndRefereshToken(
    user._id
  );

  //here were currently using the unsaved user that is why we find user again
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user logged in succesfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  //in jwt verify middleware we have same req.user  = user that is why we hvae acceess to req.user
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, //this removes the field from document
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user Logged out "));
});

const refreshAccesToken = asyncHandler(async () => {
  const incomingRefreshToken = req.cookies || req.body.cookies;

  if (!incomingRefreshToken)
    throw new ApiError(401, "incoming refresh token is not found");

  try {
    const decodedToken = Jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id);

    if (!user) throw new ApiError(401, "Invalid refresh token");

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generaterAccessAndRefereshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token Refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error.message || "Invalid Refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  //at authorization we are saving req.user = user which is this possible
  const user = await User.findById(req.user?._id);

  //this is possible because we have set up is password correct method at user model
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect)
    throw new ApiError(400, "password mentioned is not correct one");

  user.password = newPassword;

  user.save({ validateBeforeSave: false });

  //so after this pre hook is called and it automatically modifies the passsword
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.boy;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  //req.file is possible because of multer  middleware
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(200, "path specified is wrong or file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "error occured while uploading the file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res.status(200).json(200, user, "avatar updated successfully");
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  //req.file is possible because of multer  middleware
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(200, "path specified is wrong or file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "error occured while uploading the file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res.status(200).json(200, user, "CoverImage updated successfully");
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const username = req?.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        //safety measures for username
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: subscribedTo,
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscriberCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(400, "channel does exists");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched succesfully"));
});

const getWatchedHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
                {
                  $addFields: {
                    owner: {
                      $first: "$owner",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched succesfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccesToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchedHistory,
};
