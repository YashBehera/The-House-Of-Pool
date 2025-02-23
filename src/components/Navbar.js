import { Button, Select } from "antd";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { CgProfile } from "react-icons/cg";
import { useNavigate } from "react-router-dom";
import logo1 from "./HOP3.png";
import logo2 from "./HOP5.png";
import Profile from "./Profile";
import Register from "./Register";
import { auth, db } from "./firebase";
import { MenuOutlined } from "@ant-design/icons";
import "./Navbar.css"

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(!isAuthenticated && !auth.currentUser);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
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
          setIsDropdownOpen(false);
        } catch (error) {
          console.error("Error fetching user data:", error.message);
          setUserDetails({
            email: user.email,
            firstName: user.displayName || "User",
          });
          setIsDropdownOpen(false);
        }
      } else {
        setUserDetails(null);
        setIsDropdownOpen(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        userDetails
      ) {
        setIsDropdownOpen(false);
        setIsMenuOpen(false);
      }
    };

    if (isDropdownOpen || isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen, isMenuOpen, userDetails]);

  const toggleDropdown = () => setIsDropdownOpen((prev) => !prev);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

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
          onClick={() => navigate("/inventory")}
        >
          <span className="text-white">Inventory</span>
        </Button>
        <Button
          type="link"
          className="text-white text-base hover:text-gray-300"
          onClick={() => navigate("/reports")}
        >
          <span className="text-white">Reports</span>
        </Button>
        <Select
          value={selectedLocation}
          onChange={setSelectedLocation}
          className="w-40 md:w-44"
        >
          <Option value="Old House Of Pool">Old House Of Pool</Option>
          <Option value="New House Of Pool">New House Of Pool</Option>
        </Select>
      </div>

      {/* Profile/Login Dropdown */}
      <div className="flex items-center gap-4">
        <button onClick={toggleDropdown} className="flex items-center">
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

      {/* Dropdown Overlay and Content */}
      {isDropdownOpen && (
        <>
          <div className="fixed inset-0 bg-black opacity-50 z-20" />
          <div
            ref={dropdownRef}
            className="dropdown-menu fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 max-w-[40rem] h-[26rem] bg-white shadow-2xl rounded-3xl p-2 z-30 flex flex-col md:flex-row items-center gap-2 animate-fade-in"
          >
            <div className="dropdown-images w-full md:w-1/2">
              <img
                src={logo1}
                className="w-full h-[12.5rem] rounded-t-3xl"
                alt="Logo 1"
              />
              <img
                src={logo2}
                className="w-full h-[12.5rem] rounded-b-3xl"
                alt="Logo 2"
              />
            </div>
            <div className="w-full md:w-1/2 text-black p-4">
              {userDetails ? (
                <Profile userDetails={userDetails} />
              ) : (
                <Register />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Navbar;
