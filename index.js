const cors = require("cors");
const express = require("express");
const diiaRouter = require("./diiaRouter");
const PORT = process.env.PORT || 4000;

const app = express();

app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json());
app.use("/", diiaRouter);

const start = async () => {
  try {
    app.listen(PORT, () => console.log(`server is listening on port ${PORT}`));
  } catch (e) {
    console.log(e);
  }
};

start();
