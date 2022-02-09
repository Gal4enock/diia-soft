const fs = require("fs");
const path = require("path");

const diiaController = async (req, res) => {
  try {
    console.log("controller");
    const filePath = path.resolve(__dirname, "data", "encodedData.json");
    const dataEncoded = fs.readFileSync(filePath, "utf8", (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      return data;
    });
    console.log("dataEncoded", JSON.parse(dataEncoded));
    return res.status(200).json(req.body);
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "Something went wrong" });
  }
};

module.exports = diiaController;
