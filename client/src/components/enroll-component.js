import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthEntryComponent from "./auth-entry-component";
import ProductService, {
  getProductImageUrl,
} from "../services/product.service";

const EnrollComponent = ({ currentUser, setCurrentUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedType = searchParams.get("type");
  const [menuProducts, setMenuProducts] = useState([]);
  const [searchResult, setSearchResult] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [quantities, setQuantities] = useState({});

  const filterProducts = useCallback(
    (products, keyword = "") => {
      let result = products;
      const trimmedKeyword = keyword.trim().toLowerCase();

      if (selectedType) {
        result = result.filter(
          (product) => (product.type || "").trim() === selectedType
        );
      }

      if (trimmedKeyword) {
        result = result.filter((product) =>
          (product.title || "").toLowerCase().includes(trimmedKeyword)
        );
      }

      return result;
    },
    [selectedType]
  );

  useEffect(() => {
    if (!currentUser) {
      setMenuProducts([]);
      setSearchResult(null);
      return;
    }

    ProductService.getMenuProducts(currentUser)
      .then((data) => {
        const products = data.data || [];
        setMenuProducts(products);
        setSearchResult(filterProducts(products, searchInput));
      })
      .catch((e) => {
        console.log(e);
      });
  }, [currentUser, filterProducts, searchInput]);

  const handleChangeInput = (e) => {
    setSearchInput(e.target.value);
  };

  const handleQuantityChange = (e, productId) => {
    const value = Math.max(1, Number(e.target.value) || 1);
    setQuantities((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const handleSearch = () => {
    const keyword = searchInput.trim();

    if (!keyword) {
      setSearchResult(filterProducts(menuProducts));
      return;
    }

    setSearchResult(filterProducts(menuProducts, keyword));
  };

  const handleEnroll = (productId) => {
    if (!currentUser) {
      window.alert("請先登入才能加入清單");
      navigate("/login");
      return;
    }

    const quantity = Number(quantities[productId]) || 1;

    ProductService.enroll(productId, quantity)
      .then(() => {
        window.alert("您已加入清單");
        navigate("/product");
      })
      .catch((e) => {
        console.log(e);
      });
  };

  if (!currentUser) {
    return <AuthEntryComponent setCurrentUser={setCurrentUser} />;
  }

  return (
    <div className="product-page">
      <div
        className="search input-group mb-3"
        style={{ maxWidth: "60rem", margin: "0 auto" }}
      >
        <input
          type="text"
          className="form-control"
          onChange={handleChangeInput}
        />
        <button
          onClick={handleSearch}
          className="btn btn-primary"
          style={{ minWidth: "8rem" }}
        >
          搜尋餐點
        </button>
      </div>

      {searchResult && (
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {searchResult.map((product) => (
            <div
              key={product._id}
              className="card product-card"
              style={{ width: "80rem", margin: "0 auto", marginTop: "1rem" }}
            >
              <div className="card-body">
                <div
                  className="product-card-layout"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "stretch",
                    gap: "1.5rem",
                  }}
                >
                  <div
                    className="product-info-column"
                    style={{
                      width: "22rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <p className="card-text" style={{ marginBottom: "1rem" }}>
                      餐點名稱: {product.title}
                    </p>

                    <p className="card-text" style={{ marginBottom: "1rem" }}>
                      餐點價格: {product.price}
                    </p>

                    <div>
                      <div
                        className="input-group"
                        style={{ maxWidth: "18rem" }}
                      >
                        <input
                          type="number"
                          min="1"
                          placeholder="購買數量"
                          value={quantities[product._id] || ""}
                          onChange={(e) => handleQuantityChange(e, product._id)}
                          className="form-control"
                        />
                        <button
                          className="btn btn-warning"
                          onClick={() => handleEnroll(product._id)}
                          style={{ minWidth: "8rem" }}
                        >
                          加入清單
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    className="product-description-column"
                    style={{
                      flex: 1,
                      display: "flex",
                    }}
                  >
                    <p className="card-text" style={{ margin: 0 }}>
                      餐點描述: {product.description}
                    </p>
                  </div>

                  <div
                    className="product-image-wrap"
                    style={{ width: "20rem", flexShrink: 0 }}
                  >
                    {product.image && (
                      <img
                        className="product-image"
                        src={getProductImageUrl(product.image)}
                        alt={product.title}
                        style={{
                          width: "100%",
                          height: "10rem",
                          objectFit: "cover",
                          borderRadius: "0.5rem",
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnrollComponent;
