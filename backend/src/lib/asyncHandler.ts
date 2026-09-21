import { NextFunction, Request, Response } from "express";

type AsyncHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

// Express 4 tidak otomatis menangkap Promise yang reject dari handler async —
// tanpa wrapper ini, error di controller async (mis. Prisma gagal) tidak akan
// pernah sampai ke errorHandler dan request akan menggantung/crash diam-diam.
export function asyncHandler<Req extends Request = Request>(fn: AsyncHandler<Req>) {
  return (req: Req, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
