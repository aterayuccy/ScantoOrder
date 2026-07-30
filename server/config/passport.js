let JwtStrategy = require("passport-jwt").Strategy;
let ExtractJwt = require("passport-jwt").ExtractJwt;
const User = require("../models").user;
const AUTH_VERSION = Number(process.env.AUTH_VERSION || 1);

module.exports = (passport) => {
  let opts = {};
  opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("jwt");
  // opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken(); // ✅ 標準寫法

  opts.secretOrKey = process.env.PASSPORT_SECRET;

  passport.use(
    new JwtStrategy(opts, async function (jwt_payload, done) {
      try {
        if (jwt_payload.authVersion !== AUTH_VERSION) {
          return done(null, false);
        }

        let foundUser = await User.findOne({ _id: jwt_payload._id })
          .select("+guestExpiresAt")
          .exec();
        if (
          Number(jwt_payload.tokenVersion || 1) !==
          Number(foundUser?.tokenVersion || 1)
        ) {
          return done(null, false);
        }
        if (
          foundUser?.role === "buyer" &&
          foundUser.guestExpiresAt &&
          foundUser.guestExpiresAt <= new Date()
        ) {
          return done(null, false);
        }
        if (foundUser) {
          return done(null, foundUser);
        } else {
          return done(null, false);
        }
      } catch (e) {
        return done(e, false);
      }
    })
  );
};
