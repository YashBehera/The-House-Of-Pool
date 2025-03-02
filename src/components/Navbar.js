import { Button, Select, Form, Input } from "antd";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { CgProfile } from "react-icons/cg";
import { useNavigate } from "react-router-dom";
import logo1 from "./HOP3.png";
import logo2 from "./HOP5.png";
import Profile from "./Profile";
import { auth, db } from "./firebase";
import { MenuOutlined } from "@ant-design/icons";
import "./Navbar.css";
import Login from "./Login";
import { signInWithEmailAndPassword } from "firebase/auth";

const { Option } = Select;

const Navbar = ({
  selectedDate,
  setSelectedDate,
  isAuthenticated,
  selectedLocation,
  setSelectedLocation,
}) => {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState(
    auth.currentUser
      ? {
          email: auth.currentUser.email,
          firstName: auth.currentUser.displayName || "User",
        }
      : null
  );
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false); // Existing dropdown
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false); // New dropdown
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dropdownAction, setDropdownAction] = useState(null);
  const [pendingLocation, setPendingLocation] = useState(null); // Store intended location
  const [userRole, setUserRole] = useState(null); // Track user access level
  const profileDropdownRef = useRef(null); // Ref for existing dropdown
  const actionDropdownRef = useRef(null); // Ref for new dropdown
  const menuRef = useRef(null);
  const [loginForm] = Form.useForm();

  useEffect(() => {
    if (auth.currentUser) {
      setIsProfileDropdownOpen(false);
    }
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const docRef = doc(db, "Users", user.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserDetails(docSnap.data());
          } else {
            setUserDetails({
              email: user.email,
              firstName: user.displayName || "User",
            });
          }
          // Set user role based on email
          if (user.email === "hop@gmail.com") {
            setUserRole("full");
          } else if (user.email === "staff@gmail.com") {
            setUserRole("restricted");
          } else {
            setUserRole("unknown");
          }
          setIsProfileDropdownOpen(false);
        } catch (error) {
          console.error("Error fetching user data:", error.message);
          setUserDetails({
            email: user.email,
            firstName: user.displayName || "User",
          });
          setUserRole("unknown");
          setIsProfileDropdownOpen(false);
        }
      } else {
        setUserDetails(null);
        setUserRole(null);
        setIsProfileDropdownOpen(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isOutsideProfileDropdown =
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target);
      const isOutsideActionDropdown =
        actionDropdownRef.current &&
        !actionDropdownRef.current.contains(event.target);
      const isOutsideMenu =
        menuRef.current && !menuRef.current.contains(event.target);

      // Close profile dropdown only if authenticated and clicking outside
      if (isOutsideProfileDropdown && userDetails) {
        setIsProfileDropdownOpen(false);
      }

      // Always close action dropdown and menu when clicking outside
      if (isOutsideActionDropdown) {
        setIsActionDropdownOpen(false);
      }
      if (isOutsideMenu) {
        setIsMenuOpen(false);
      }
    };

    if (isProfileDropdownOpen || isActionDropdownOpen || isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileDropdownOpen, isActionDropdownOpen, isMenuOpen, userDetails]);

  const toggleProfileDropdown = () => setIsProfileDropdownOpen((prev) => !prev);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  const showActionDropdown = (action, value = null) => {
    setDropdownAction(action);
    if (action === "location" && value) {
      setPendingLocation(value);
    }
    setIsActionDropdownOpen(true);
  };

  const handleLoginSubmit = async (values) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        values.email
      );
      const user = userCredential.user;
      setIsActionDropdownOpen(false);
      loginForm.resetFields();

      // Set user role based on credentials
      if (values.email === "hop@gmail.com") {
        setUserRole("full");
        switch (dropdownAction) {
          case "inventory":
            navigate("/inventory");
            break;
          case "reports":
            navigate("/reports");
            break;
          case "expenses":
            navigate("/expenses");
            break;
          case "location":
            if (pendingLocation) {
              setSelectedLocation(pendingLocation);
              setPendingLocation(null);
            }
            break;
          default:
            navigate("/"); // Default to Home
            break;
        }
      } else if (values.email === "staff@gmail.com") {
        setUserRole("restricted");
        navigate("/"); // Restricted users go to Home
        alert("You have restricted access and can only view the Home page.");
      } else {
        setUserRole("unknown");
        navigate("/"); // Unknown users go to Home
        alert("Your account does not have access to restricted features.");
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Invalid email or password. Please try again.");
      setPendingLocation(null);
    }
  };

  const handleRestrictedAction = (action) => {
    if (!userRole) {
      alert("You do not have permission to access this feature.");
    } else if (userRole === "full") {
      switch (action) {
        case "inventory":
          navigate("/inventory");
          break;
        case "reports":
          navigate("/reports");
          break;
        case "expenses":
          navigate("/expenses");
          break;
        default:
          break;
      }
    } else {
      alert("You do not have permission to access this feature.");
    }
  };

  const handleSelectClick = () => {
    if (userRole === "restricted") {
      alert("You do not have permission to access this feature.");
    }
  };

  const handleLocationChange = (value) => {
    if (!userRole) {
      alert("You do not have permission to access this feature.");
    } else if (userRole === "full") {
      setSelectedLocation(value);
    } else {
      // For restricted or unknown, alert is handled by onClick
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full bg-[#001529] text-white flex items-center justify-between px-4 py-2 z-10">
      {/* Title */}
      <button
        className="text-xl md:text-2xl font-semibold"
        onClick={() => navigate("/")}
      >
        The House Of Pool
      </button>

      {/* Mobile Menu Toggle */}
      <div className="md:hidden">
        <Button
          type="link"
          icon={<MenuOutlined />}
          onClick={toggleMenu}
          className="text-white text-xl"
        />
      </div>

      {/* Navigation Links and Location Select */}
      <div
        ref={menuRef}
        className={`${
          isMenuOpen ? "flex" : "hidden"
        } md:flex flex-col md:flex-row items-center justify-center absolute md:static top-12 left-0 w-full md:w-auto bg-[#001529] md:bg-transparent p-4 md:p-0 gap-4`}
      >
        <Button
          type="link"
          className="text-white text-base hover:text-gray-300"
          onClick={() => navigate("/")}
        >
          <span className="text-white">Home</span>
        </Button>
        <Button
          type="link"
          className="text-white text-base hover:text-gray-300"
          onClick={() => handleRestrictedAction("inventory")}
        >
          <span className="text-white">Inventory</span>
        </Button>
        <Button
          type="link"
          className="text-white text-base hover:text-gray-300"
          onClick={() => handleRestrictedAction("reports")}
        >
          <span className="text-white">Reports</span>
        </Button>
        <Button
          type="link"
          className="text-white text-base hover:text-gray-300"
          onClick={() => handleRestrictedAction("expenses")}
        >
          <span className="text-white">Expenses</span>
        </Button>
        {userRole !== "restricted" ? (
          <Select
            value={selectedLocation}
            onClick={handleSelectClick} // Show alert for restricted users (though not triggered here)
            onChange={handleLocationChange} // Handle selection for full access
            className="w-40 md:w-44"
          >
            <Option value="Old House Of Pool">Old House Of Pool</Option>
            <Option value="New House Of Pool">New House Of Pool</Option>
          </Select>
        ) : (
          <Button
            type="link"
            className="text-white text-base hover:text-gray-300 w-40 md:w-44"
            onClick={handleSelectClick}
          >
            <span className="text-white">{selectedLocation}</span>
          </Button>
        )}
      </div>

      {/* Profile/Login Dropdown (Existing) */}
      <div className="flex items-center gap-4">
        <button onClick={toggleProfileDropdown} className="flex items-center">
          <div className="flex items-center justify-center text-lg md:text-2xl h-8 md:h-10 w-20 md:w-24 bg-white rounded-full">
            {userDetails ? (
              <div className="flex items-center">
                {userDetails.photo ? (
                  <img
                    src={userDetails.photo}
                    alt="Profile"
                    className="w-6 h-6 md:w-8 md:h-8 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm md:text-base">
                    {userDetails.firstName ? userDetails.firstName[0] : "U"}
                  </div>
                )}
                <span className="font-light text-xs md:text-sm text-black ml-1 md:ml-2">
                  {userDetails.firstName}
                </span>
              </div>
            ) : (
              <div className="flex items-center">
                <CgProfile className="text-black ml-2 md:ml-5" />
                <span className="font-light text-xs md:text-sm text-black ml-1">
                  Login/SignUp
                </span>
              </div>
            )}
          </div>
        </button>

        {/* Calendar */}
        <div className="hidden md:flex items-center gap-2">
          <h2 className="text-white text-sm font-bold">📅 Select Date</h2>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-1 text-sm rounded-md border border-gray-300 bg-white text-gray-700 outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Mobile Calendar (below navbar) */}
      <div className="md:hidden absolute top-12 right-4 flex items-center gap-2 bg-[#001529] p-2">
        <h2 className="text-white text-sm font-bold">📅 Date</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="p-1 text-sm rounded-md border border-gray-300 bg-white text-gray-700 outline-none cursor-pointer"
        />
      </div>

      {/* Existing Dropdown (Profile/Login) */}
      {isProfileDropdownOpen && (
        <>
          <div className="fixed inset-0 bg-black opacity-50 z-20" />
          <div
            ref={profileDropdownRef}
            className="dropdown-menu fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 min-w-[30rem] md:max-w-[40rem] md:h-[26rem] h-[20rem] bg-white shadow-2xl rounded-3xl p-2 z-30 flex flex-row md:flex-row items-center justify-center animate-fade-in"
          >
            <div className="dropdown-images w-full md:w-full h-[19rem] md:h-[25rem] flex flex-col items-center justify-center">
              <img
                src={logo1}
                className="w-full h-10 md:h-[12.5rem] rounded-t-3xl"
                alt="Logo 1"
              />
              <img
                src={logo2}
                className="w-full h-10 md:h-[12.5rem] rounded-b-3xl"
                alt="Logo 2"
              />
            </div>
            <div className="w-full md:w-full text-black p-4 flex flex-col items-center justify-center">
              {userDetails ? <Profile userDetails={userDetails} /> : <Login />}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Navbar;
