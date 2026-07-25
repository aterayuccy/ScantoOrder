import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductService from "../services/product.service";

const PostProductComponent = (props) => {
  let { currentUser } = props;
  let [title, setTitle] = useState("");
  let [description, setDescription] = useState("");
  let [price, setPrice] = useState(0);
  let [message, setMessage] = useState("");
  let [type, setType] = useState("");
  let [image, setImage] = useState("");
  const navigate = useNavigate();
  const handleTakeToLogin = () => {
    navigate("/login");
  };
  const handleChangeImage = (e) => {
  setImage(e.target.files[0]);
};
  const handleChangeTitle = (e) => {
    setTitle(e.target.value);
  };
  const handleChangeDesciption = (e) => {
    setDescription(e.target.value);
  };
  const handleChangePrice = (e) => {
    setPrice(e.target.value);
  };
  const handleChangeType = (e) => {
    setType(e.target.value);
  };
  const postProduct = () => {
    ProductService.post(title, description, price,type,image)
      .then(() => {
        window.alert("新商品已發布成功");
        navigate("/myProduct");
      })
      .catch((error) => {
        console.log(error.response);
        setMessage(error.response.data);
      });
  };

  return (
    <div style={{ padding: "3rem" }}>
      {!currentUser && (
        <div>
          <p>在發布新商品之前，您必須先登錄。</p>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleTakeToLogin}
          >
            帶我進入登錄頁面。
          </button>
        </div>
      )}      
      {currentUser && currentUser.user.role === "seller" && (
        <div className="form-group">
          <label for="exampleforTitle">商品標題：</label>
          <input
            name="title"
            type="text"
            className="form-control"
            id="exampleforTitle"
            onChange={handleChangeTitle}
          />
          <br />
          <label for="exampleforContent">內容：</label>
          <textarea
            className="form-control"
            id="exampleforContent"
            name="content"
            onChange={handleChangeDesciption}
          />
          <br />
          <label for="exampleforPrice">價格：</label>
          <input
            name="price"
            type="number"
            className="form-control"
            id="exampleforPrice"
            onChange={handleChangePrice}
          />
          <br />
          <label for="exampleforType">分類：</label>
          <input
            name="type"
            type="text"
            className="form-control"
            id="exampleforType"
            onChange={handleChangeType}
          />
          <br />
          <label htmlFor="exampleforImage">商品圖片：</label>
          <input
            name="image"
            type="file"
            className="form-control"
            id="exampleforImage"
            accept="image/*"
            onChange={handleChangeImage}
          />
          <br />
          <button className="btn btn-primary" onClick={postProduct}>
            交出表單
          </button>
          <br />
          <br />
          {message && (
            <div className="alert alert-warning" role="alert">
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostProductComponent;
