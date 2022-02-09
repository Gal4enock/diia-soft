const Router = require("express");
const multer = require("multer");
const getEncodeInfo = require("./decode");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./data");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });
const diiaController = require("./diiaController");

const router = new Router();
const decodedFiles = async (req, res, next) => {
  await getEncodeInfo((err, result) => {
    console.log(result);
    if (!err) {
      next();
    }
  });

  // setTimeout(function () {
  //   next();
  // }, 5000);
  // next();
};

router.post("/", upload.any(), decodedFiles, diiaController);

module.exports = router;
