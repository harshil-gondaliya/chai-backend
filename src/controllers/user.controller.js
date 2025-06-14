import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { trusted } from "mongoose";

const generateAccessAndRefreshTokens = async(userId) =>
{
  try {
    const user = await User.findById(userId)
   const accessToken =  user.generateAccessToken()
   const refreshToken = user.generateRefreshToken()
   
   user.refreshToken = refreshToken
  await user.save({ ValidateBeforeSave: false })
  
  return {accessToken , refreshToken}
  
  }
   catch (error) {
    throw new ApiError(500,"something went wrong while generating refresh and access token")
  }
}
 


const registerUser = asyncHandler( async (req , res) => {
    // get user details from frontend
    // validation - not empty
    // checj if user already exists :  username or email
    // check for images check for avatar
    // upload them to cloudinary , avatar
    // create  user object - create entry in db
    // remove password and refresh token feild from response
    // check for user creation
    // return res
    
    
    //1
    const {fullname ,email ,username , password} = req.body
    console.log("email: ",email);
    
    //2
  if (
    [fullname , email , username , password].some((field) => field?.trim() === "")
  ) {
      throw new ApiError(400,"all feild are required")
  }
  
  //3
  const existedUser = await User.findOne({
    $or: [{username} , {email}]
  })
  
  if(existedUser)
  {
    throw new ApiError(409,"username and email already exists")
  }
  
  
  //4
   const avatarLocalPath =  req.files?.avatar[0]?.path;
   const coverImageLocalPath = req.files?.coverImage[0]?.path;
   
   if (!avatarLocalPath) {
    throw new ApiError(400,"avatar file is required")
   }

   //5
   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
  
  if (!avatar) {
    throw new ApiError(400,"avatar file is required")
  }
  
  //6
  const user = await User.create({
    fullname  ,
    avatar : avatar.url ,
    coverImage : coverImage?.url || "" ,
    email ,
    password ,
    username : username.toLowerCase()
  })  
  
  //7
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )
  //8
  if (!createdUser) {
    throw new ApiError(500,"something went wrong while register the user")
  }
  
  //9
  return res.status(201).json(
    new ApiResponse(200,createdUser,"user register successfully !!")
  )
  
  
  
  
} )


const loginUser = asyncHandler(async (req ,res ) =>{
  // req body -> data
  // username or email
  // find the user
  // password check
  // access and refresh token
  // send cookie 
  
  //1
  const {email ,username , password} = req.body
  
  //2
  if(!username && !email)
  {
    throw new ApiError(400,"username or email is required")
  }
  
  //3
  const user = await User.findOne({
    $or:[{username},{email}]
  })
  
  if(!user)
  {
    throw new ApiError(404,"user does not exist")
  }
  
  //4
 const isPasswordValid =  await user.isPasswordCorrect(password)
  
 
  if(!isPasswordValid)
  {
    throw new ApiError(401,"Invalid user credentials")
  }
  
  //5
const {accessToken , refreshToken} = await generateAccessAndRefreshTokens(user._id)
  
//6
const loggedInUser = await User.findById(user._id).select("-passwod -refreshToken")

const options = {
  httpOnly :true ,
  secure :true ,
}
 return res
 .status(200)
 .cookie("accessToken",accessToken , options)
 .cookie("refreshToken",refreshToken ,options)
 .json(
  new ApiResponse(
    200,
    {
      user:loggedInUser , accessToken ,refreshToken 
    },
    "User logged In Successfully"
  )
 )
 
})

const logoutUser = asyncHandler(async(req,res) => {
  User.findByIdAndUpdate(
    req.user._id,
    {
      $set :{
        refreshToken:undefined
      }
    },
    {
      new:true
    }
  )
  
const options = {
  httpOnly :true ,
  secure :true ,
  
}

return res
.status(200)
.clearCookie("accessToken" , options)
.clearCookie("refreshToken" ,options)
.json(new ApiResponse(200,{},"User logged out"))
})

 
const refreshAccessToken = asyncHandler(async(req,res) =>{
 const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
 
 if(!incomingRefreshToken)
 {
  throw new ApiError(401,"unauthorized request")
 }
try {
   
  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
   )
   
   const user = await User.findById(decodedToken?._id)
   
   if(!user)
   {
    throw new ApiError(401,"Invalid refresh token")
   }
   
   if(incomingRefreshToken !== user?.refreshToken)
   {
    throw new ApiError(401,"Refresh token is expired or used")
   }
   
   const options = {
    httpOnly :true ,
    secure:true
   }
   
   const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
   
   return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",newRefreshToken ,options)
   .json(
    new ApiResponse(
      200,
      {
        accessToken ,refreshToken:newRefreshToken
      },
      "access token refreshed"
    )
   )
   
} catch (error) {
  throw new ApiError(401,error?.message || "Invalid refresh token")
}
 
 
})


const changeCurrentPassword = asyncHandler(async(req,res) => {
  const {oldPassword , newPassword} = req.body
  
  const user = await User.findById(req.user?._id)
  
 const isPasswordcorrect = await user.idPasswordCorrect(oldPassword)
 
 if(!isPasswordCorrect)
 {
  throw new ApiError(400,"invalid old password")
 }
 
 user.password = newPassword
await user.save({validateBeforeSave : false})

return res
.status(200)
.json(new ApiResponse(200,{},"Password changed successfully"))

})



const getCurrentUser = asyncHandler(async(req,res) => {
  return res
  .status(200)
  .json(200,req.user,"Current user fatched successfully")
})


const updateAccountDetails = asyncHandler(async(req,res) => {
  const {fullname , email ,} = req.body
  
  if(!fullname || !email)
  {
    throw new ApiError(400,"All field are required")
  }
  
const user = User.findByIdAndUpdate(
  req.user?._id,
{
  $set:{
    fullname ,
    email : email,
  }
},
{new :true}
).select("-password")

return res
.status(200)
.json(new ApiResponse(200 ,user ,"Account details updated successfully"))
  
})

const updateUserAvatar = asyncHandler(async(req,res) => {
 const avatarLocalPath = req.file?.path
 
 if(!avatarLocalPath)
 {
  throw new ApiError(400,"avatar file is missing")
 }
 
 const avatar = await uploadOnCloudinary(avatarLocalPath)
 
 if(!avatar.url)
 {
    throw new ApiError(400,"Error while uploading on avatar")
 }
 
const user = await User.findByIdAndUpdate(
  req.user?._id,
  {
    $set :{
      avatar : avatar.url 
    }
  },
  {new :true}
 ).select("-password")
 
 return res
 .status(200)
 .json(new ApiResponse(200,user,"cover image upload Successfully"))
 
 
})

const updateUserCoverImage = asyncHandler(async(req,res) => {
 const coverImageLocalPath = req.file?.path
 
 if(!coverImageLocalPath)
 {
  throw new ApiError(400,"Cover Image file is missing")
 }
 
 const coverImage = await uploadOnCloudinary(coverImageLocalPath)
 
 if(!coverImage.url)
 {
    throw new ApiError(400,"Error while uploading on cover Image")
 }
 
const user = await User.findByIdAndUpdate(
  req.user?._id,
  {
    $set :{
      coverImage : coverImage.url 
    }
  },
  {new :true}
 ).select("-password")
 
 return res
 .status(200)
 .json(new ApiResponse(200,user,"cover image upload Successfully"))
 
})



export {
  registerUser,
loginUser ,
logoutUser,
refreshAccessToken,
changeCurrentPassword,
getCurrentUser,
updateAccountDetails,
updateUserAvatar,
updateUserCoverImage,
}