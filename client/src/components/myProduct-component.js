import React,{useState,useEffect} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import ProductService from "../services/product.service";
import { UPLOADS_URL } from "../services/product.service";

const MyProductComponent = ({currentUser,setCurrentUser}) => {
    const navigate=useNavigate();
    const [searchParams] = useSearchParams();
    const selectedType = searchParams.get("type");
    const handleTakeToLogin = () => {
        navigate('/login');
    }
    const postProduct = () => {
    navigate("/postProduct");
  };
    let [searchResult,setSearchResult]=useState(null)
    let [searchInput,setSearchInput]=useState('')  
    
    
    useEffect(()=>{
        let _id;
        if (currentUser){
            _id = currentUser.user._id;
            if(currentUser.user.role=="seller"){
                ProductService.get(_id)
                .then((data) => {
                     let result = data.data;

          if (selectedType) {
            result = result.filter(
              (product) => (product.type || "").trim() === selectedType
            );
          }
                    setSearchResult(result);
                })
                .catch((e)=>{
                    console.log(e);
                })
            } else if(currentUser.user.role=="buyer"){
                console.log("買家")
                ProductService.getEnrolledProduct(_id)
                .then((data)=>{
                    setSearchResult(data.data);
                }).catch((e)=>{
                    console.log(e);
                })
            }
        }
    }, [currentUser, selectedType]    )

    const handleModify = (productId) => {
        navigate(`/modifyProduct/${productId}`); 
        };
    const handleChangeInput =(e) =>{
        setSearchInput(e.target.value)
    }
    
    const handleSearch =  () => {       
        const keyword = searchInput.trim();
        if (!currentUser) return;

        ProductService.get(currentUser.user._id)
          .then((data) => {
        const myProducts = data.data;
        
        if (!keyword) {
          setSearchResult(myProducts);
          return;
        }

        const filteredProducts = myProducts.filter((product) =>
          product.title.toLowerCase().includes(keyword)
        );

        setSearchResult(filteredProducts);
      })
      .catch((e) => {
        console.log(e);
      });
        }
    const handleDelete = (productId) => {
    if (!window.confirm("確定要刪除這個商品嗎？")) return;

    

    ProductService.deleteProduct(productId)
        .then(() => {
        window.alert("刪除成功");
        setSearchResult((prev) => prev.filter((p) => p._id !== productId));
        })
        .catch((e) => {
        console.log(e);
        window.alert("刪除失敗");
        });
    };


    return (<div className="product-page">
    {!currentUser && (
            <div>
                <p>您必須先登入</p>
                <button 
                className="btn btn-primary btn-lg"
                onClick={handleTakeToLogin}>回到登入頁面</button>
            </div>
        )}   

    
    <div className="search input-group mb-3" style={{ maxWidth: "60rem" , margin: "0 auto"}}>
        <input 
        type="text" 
        className="form-control"
        onChange={handleChangeInput}
        />
        <button onClick={handleSearch} className="btn btn-primary" style={{minWidth: "8rem"}}>搜尋商品</button>
    </div>

        
    {currentUser && searchResult  && (
        <div style={{display:"flex",flexWrap:"wrap"}} >
            {searchResult.map((product)=>{
                return (<div
  className="card product-card"
  style={{ width: "80rem", margin: "0 auto" , marginTop: "1rem"}}
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
      {/* 左半部：按鈕 + 資訊 + 描述 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "stretch",
          gap: "3rem",
        }}
      >
        {/* 最左：三按鈕 */}
        <div
          className="product-info-column seller-product-actions"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minWidth: "8rem",
          }}
        >
          <button
            className="btn btn-info"
            onClick={() => navigate(`/buyerInfo/${product._id}`)}
          >
            買家資訊
          </button>

          <button
            className="btn btn-warning"
            onClick={() => handleModify(product._id)}
          >
            修改餐點
          </button>

          <button
            className="btn btn-danger"
            onClick={() => handleDelete(product._id)}
          >
            刪除餐點
          </button>
        </div>

        {/* 中間：名稱 / 價格 / 數量 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minWidth: "3rem",
          }}
        >
          <p style={{ margin: 0 }} className="card-text">
            餐點名稱: {product.title}
          </p>

          <p style={{ margin: 0 }}>
            餐點價格: {product.price}
          </p>

          <p style={{ margin: 0 }}>
            需求數量: {product.buyer.reduce((t, b) => t + (Number(b.quantity) || 0), 0)}
          </p>
        </div>

        {/* 再右：描述 */}
        <div
          style={{
            flex: 1,
            display: "flex",
          }}
        >
          <p style={{ margin: 0 }} className="card-text">
            餐點描述: {product.description}
          </p>
        </div>
      </div>

      {/* 最右：圖片 */}
      <div
        className="product-image-wrap seller-product-image-wrap"
        style={{
          width: "20rem",
          flexShrink: 0,
        }}
      >
        {product.image ? (
          <img
            className="product-image seller-product-image"
            src={`${UPLOADS_URL}/${product.image}`}
            alt={product.title}
            style={{
              width: "100%",
              height: "10rem",
              objectFit: "cover",
              borderRadius: "0.5rem",
            }}
          />
        ) : (
          <div className="product-image seller-product-image product-image-placeholder" />
        )}
      </div>
    </div>
  </div>
</div>
                
            )
            
        })            
            
            }
           
        </div>    
        )}
        <div className="text-center" style={{ marginTop: "2rem" }}>
          <button style={{ minWidth: "8rem" }} className="btn btn-primary" onClick={postProduct}>
            新增餐點
          </button>
        </div>
    </div>    )}



export default MyProductComponent;
