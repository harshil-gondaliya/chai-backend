import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
  const existedUser =  User.findOne({
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



export {registerUser}