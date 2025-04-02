import { Button, Select, Form, Input } from "antd";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { CgProfile } from "react-icons/cg";
import { useNavigate, useLocation } from "react-router-dom";
import logo1 from "./HOP3.png";
import logo2 from "./HOP5.png";
import Profile from "./Profile";
import { auth, db } from "./firebase";
import { MenuOutlined } from "@ant-design/icons";
import "./Navbar.css";
import Login from "./Login";
import logo from "./logo.png";
import logohop from "./image.png";

const { Option } = Select;

const Navbar = ({
  selectedDate,
  setSelectedDate,
  selectedLocation,
  setSelectedLocation,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userDetails, setUserDetails] = useState(null);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isActionLoginOpen, setIsActionLoginOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dropdownAction, setDropdownAction] = useState(null);
  const [pendingLocation, setPendingLocation] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isActionAuthenticated, setIsActionAuthenticated] = useState(false);
  const profileDropdownRef = useRef(null);
  const actionDropdownRef = useRef(null);
  const menuRef = useRef(null);
  const [loginForm] = Form.useForm();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const docRef = doc(db, "Users", user.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUserDetails(userData);
            setUserRole(userData.role || "unknown");
            setIsActionAuthenticated(userData.role === "admin"); // Admin has full access by default
            if (userData.role === "restricted" && userData.location) {
              setSelectedLocation(userData.location); // Pre-set location for restricted users
            }
          } else {
            // Default user setup if no Firestore doc exists
            const email = user.email;
            setUserDetails({
              email,
              firstName: user.displayName || "User",
            });
            if (email === "hop@gmail.com") {
              setUserRole("admin");
              setIsActionAuthenticated(true);
            } else if (
              email === "oldhop@gmail.com" ||
              email === "newhop@gmail.com"
            ) {
              setUserRole("restricted");
              setIsActionAuthenticated(false);
              setSelectedLocation(
                email === "oldhop@gmail.com"
                  ? "Old House Of Pool"
                  : "New House Of Pool"
              );
            } else {
              setUserRole("unknown");
              setIsActionAuthenticated(false);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error.message);
          setUserDetails({
            email: user.email,
            firstName: user.displayName || "User",
          });
          setUserRole("unknown");
          setIsActionAuthenticated(false);
        }
      } else {
        setUserDetails(null);
        setUserRole(null);
        setIsActionAuthenticated(false);
        setIsProfileDropdownOpen(true);
      }
    });
    return () => unsubscribe();
  }, [setSelectedLocation]);

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

      if (isOutsideProfileDropdown && userDetails) {
        setIsProfileDropdownOpen(false);
      }
      if (isOutsideActionDropdown) {
        setIsActionLoginOpen(false);
      }
      if (isOutsideMenu) {
        setIsMenuOpen(false);
      }
    };

    if (isProfileDropdownOpen || isActionLoginOpen || isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileDropdownOpen, isActionLoginOpen, isMenuOpen, userDetails]);

  const toggleProfileDropdown = () => setIsProfileDropdownOpen((prev) => !prev);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  const handleRestrictedAction = (action) => {
    if (!userRole) {
      setIsProfileDropdownOpen(true);
    } else if (userRole === "admin" || isActionAuthenticated) {
      switch (action) {
        case "inventory":
          navigate(`/inventory?location=${selectedLocation}`);
          break;
        case "reports":
          navigate(`/reports?location=${selectedLocation}`);
          break;
        default:
          break;
      }
    } else if (userRole === "restricted") {
      setDropdownAction(action);
      setIsActionLoginOpen(true);
    }
  };

  const handleSelectClick = () => {
    if (userRole === "restricted" && !isActionAuthenticated) {
      setDropdownAction("location");
      setIsActionLoginOpen(true);
    }
  };

  const handleLocationChange = (value) => {
    if (!userRole) {
      setIsProfileDropdownOpen(true);
    } else if (userRole === "admin" || isActionAuthenticated) {
      setSelectedLocation(value);
      if (userRole === "restricted") {
        setIsActionAuthenticated(false); // Reset after action
      }
      if (userRole === "admin") {
        const currentPath = location.pathname;
        navigate(`${currentPath}?location=${value}`);
      }
    } else if (userRole === "restricted") {
      setPendingLocation(value);
      setDropdownAction("location");
      setIsActionLoginOpen(true);
    }
  };

  const handleActionLoginSubmit = async (values) => {
    const { password } = values;
    const user = auth.currentUser;

    if (user) {
      const docRef = doc(db, "Users", user.uid);
      const docSnap = await getDoc(docRef);
      let adminPassword = "defaultAdminPassword"; // Fallback (set in Firestore ideally)

      if (docSnap.exists() && docSnap.data().adminPassword) {
        adminPassword = docSnap.data().adminPassword;
      }

      if (password === adminPassword) {
        setIsActionAuthenticated(true);
        switch (dropdownAction) {
          case "inventory":
            navigate(
              `/inventory?location=${pendingLocation || selectedLocation}`
            );
            break;
          case "reports":
            navigate(
              `/reports?location=${pendingLocation || selectedLocation}`
            );
            break;
          case "location":
            if (pendingLocation) {
              setSelectedLocation(pendingLocation);
              setPendingLocation(null);
              setIsActionAuthenticated(false); // Reset after location change
              const currentPath = location.pathname;
              navigate(`${currentPath}?location=${pendingLocation}`);
            }
            break;
          default:
            break;
        }
        setIsActionLoginOpen(false);
        loginForm.resetFields();
      } else {
        alert("Invalid admin password. Please try again.");
      }
    } else {
      alert("No user is logged in.");
    }
  };

  const getHomeLocation = () => {
    if (
      userRole === "restricted" &&
      pendingLocation &&
      !isActionAuthenticated
    ) {
      return pendingLocation;
    }
    return selectedLocation;
  };

  return (
    <div className="fixed top-0 left-0 w-full h-[56px] bg-[#001529] text-white flex items-center justify-between px-4 py-2 z-10">
      {/* Title */}
      <div className="flex gap-4 ">
        <button
          className="text-xl md:text-2xl font-semibold"
          onClick={() => navigate("/")}
        >
          The House Of Pool
        </button>
        <img src={logo} className="h-[53px] m-[3px] rounded-b-3xl" alt="Logo" />
        <img src={logohop} className="h-[56px]" alt="LogoHOP" />
      </div>

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
          onClick={() => navigate(`/queue?location=${getHomeLocation()}`)}
        >
          <span className="text-white">Waiting</span>
        </Button>
        {userRole !== "restricted" || isActionAuthenticated ? (
          <Select
            value={selectedLocation}
            onClick={handleSelectClick}
            onChange={handleLocationChange}
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

      {/* Profile/Login Dropdown */}
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

      {/* Mobile Calendar */}
      <div className="md:hidden absolute top-12 right-4 flex items-center gap-2 bg-[#001529] p-2">
        <h2 className="text-white text-sm font-bold">📅 Date</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="p-1 text-sm rounded-md border border-gray-300 bg-white text-gray-700 outline-none cursor-pointer"
        />
      </div>

      {/* Profile/Login Dropdown */}
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

      {/* Action Login Dropdown with Admin Password */}
      {isActionLoginOpen && (
        <>
          <div className="overlay fixed top-0 left-0 w-full h-full bg-zinc-900 opacity-50 z-10"></div>
          <div
            ref={actionDropdownRef}
            className="dropdown-menu fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 max-w-[40rem] h-[26rem] bg-white shadow-2xl rounded-3xl p-2 z-30 flex flex-row md:flex-row items-center gap-2 animate-fade-in"
          >
            <div>
              <img
                src={logo1}
                className="h-[12.5rem] w-[30rem] rounded-t-3xl"
                alt="Logo 1"
              />
              <img
                src={logo2}
                className="h-[12.5rem] w-[30rem] rounded-b-3xl"
                alt="Logo 2"
              />
            </div>
            <div className="bg-gray-100 h-[25rem] w-[30rem] text-black rounded-3xl shadow-xl shadow-gray-400 p-5">
              <div className="flex mt-1 ml-10 w-60 flex-col items-center justify-center">
                <span className="text-3xl font-bold text-black text-center relative bottom-4">
                  The House Of Pool
                </span>
                <h3>Enter Admin Password to Access {dropdownAction}</h3>
              </div>
              <div>
                <Form
                  form={loginForm}
                  onFinish={handleActionLoginSubmit}
                  className="flex flex-col items-center justify-center"
                >
                  <Form.Item
                    name="password"
                    label="Admin Password"
                    rules={[
                      {
                        required: true,
                        message: "Please enter the admin password",
                      },
                    ]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      Submit
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Navbar;
