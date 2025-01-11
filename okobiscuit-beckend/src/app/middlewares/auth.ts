import jwt, { JwtPayload } from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import appError from '../errors/appError';
import httpStatus from 'http-status';
import config from '../config';
import { TUserRole } from '../modules/Users/user.interface';
import { User } from '../modules/Users/user.model';

const auth = (...requiredRoles: TUserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;

    // checking if the token is missing
    if (!token) {
      throw new appError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

    let decoded;

    try {
      // checking if the given token is valid
      decoded = jwt.verify(
        token,
        config.jwt_access_token as string,
      ) as JwtPayload;
    } catch (error) {
      throw new appError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      // console.log('decodedError--=>', error);
    }

    const { role, email, iat } = decoded;

    // checking if the user is exist
    const user = await User.isUserExistsByEmail(email);

    if (!user) {
      throw new appError(httpStatus.NOT_FOUND, 'This user is not found !');
    }

    // checking if the user is already deleted
    const isDeleted = user?.isDeleted;

    if (isDeleted) {
      throw new appError(httpStatus.FORBIDDEN, 'This user is deleted !');
    }

    //checking admin approval
    if (!user.isAdminApproved) {
      throw new appError(
        httpStatus.NOT_ACCEPTABLE,
        'Please Waiting for admin approval',
      );
    }

    if (requiredRoles && !requiredRoles.includes(role)) {
      throw new appError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

    if (
      user.passwordChangedAt &&
      User.isJWTIssuedBeforePasswordChanged(
        user.passwordChangedAt,
        iat as number,
      )
    ) {
      throw new appError(
        httpStatus.UNAUTHORIZED,
        'You Need to Login first, you are not authorized!',
      );
    }

    req.user = decoded;
    next();
  });
};

export default auth;
