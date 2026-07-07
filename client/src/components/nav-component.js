import {useEffect,useState}from "react";
import { Link , useLocation } from "react-router-dom";
import AuthService from "../services/auth.service";
import ProductService from "../services/product.service";

const NavComponent = ({currentUser,setCurrentUser}) => {
  const [types, setTypes] = useState([]);
  const location = useLocation();
  // const [searchParams] = useSearchParams();
  // const selectedType = searchParams.get("type");
  useEffect(() => {
    if (!currentUser) {
      setTypes([]);
      return;
    }

    ProductService.getMenuProducts(currentUser)
      .then((res) => {
        const uniqueTypes = [
          ...new Set(
            res.data
              .map((product) => (product.type || "").trim())
              .filter((type) => type !== "")
          ),
        ];

        setTypes(uniqueTypes);
      })
      .catch((e) => console.log(e));
  }, [currentUser, location.pathname]);

  return (
    <div>
      <nav>
        <nav className="navbar navbar-expand-lg navbar-light bg-light">
          <div className="container-fluid">
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarNav"
              aria-controls="navbarNav"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>

            <div className="collapse navbar-collapse w-100" id="navbarNav">
              <ul className="navbar-nav"> 
                {currentUser  && currentUser.user.role=="seller" &&
                <li className="nav-item">
                  <Link className="nav-link" to="/profile">
                    個人頁面
                  </Link>
                </li>}
                
                {currentUser  &&  currentUser.user.role=="buyer"  && 
                <li className="nav-item">
                  <Link className="nav-link active" to="/" onClick={() => AuthService.markQrBuyerNavigation()}>
                    全部餐點
                  </Link>
                </li>    }

                {currentUser  &&  currentUser.user.role=="buyer"  && 
                types.map((type) => (
                <li className="nav-item" key={type}>
                  <Link className="nav-link" to={`/?type=${type}`} onClick={() => AuthService.markQrBuyerNavigation()}>
                    {type}
                  </Link>
                </li>
              ))   }   

              {currentUser  &&  currentUser.user.role=="seller"  && 
               <li className="nav-item">
                  <Link className="nav-link active" to="/myProduct">
                    全部餐點
                  </Link>
                </li>}    

                {currentUser  &&  currentUser.user.role=="seller"  && 
                types.map((type) => (
                <li className="nav-item" key={type}>
                  <Link className="nav-link" to={`/myProduct/?type=${type}`}>
                    {type}
                  </Link>
                </li>
              ))   }    
              </ul>


              <ul className="navbar-nav ms-auto">
                 {!currentUser &&
                <li className="nav-item">
                  <Link className="nav-link" to="/register">
                    註冊會員
                  </Link>
                </li>}

                {!currentUser &&
                <li className="nav-item">
                  <Link className="nav-link" to="/login">
                    會員登入
                  </Link>
                </li>}   

              {currentUser && currentUser.user.role == 'seller' &&
                <li className="nav-item">
                  <Link className="nav-link" to="/qrcode">
                    QRCODE
                  </Link>
                </li>}
                
              {currentUser && currentUser.user.role == 'seller' &&
              <li className="nav-item">
                <Link className="nav-link" to="/order">
                  訂單資訊
                </Link>
              </li>}  
              

              {currentUser && currentUser.user.role == 'buyer' &&
                <li className="nav-item">
                  <Link className="nav-link" to="/product">
                    購買紀錄
                  </Link>
                </li>}

              </ul>
            </div>
          </div>
        </nav>
      </nav>
    </div>
  );
};

export default NavComponent;
