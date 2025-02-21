import React, { useState, useEffect, useRef } from "react";
import { Button,Select } from "antd";
import { useNavigate } from "react-router-dom";
import Register from "./Register";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import Profile from "./Profile";
import { CgProfile } from "react-icons/cg";
import "./style.css";
import logo1 from "./HOP3.png";
import logo2 from "./HOP5.png";

const { Option } = Select;

const Navbar = ({ selectedDate, setSelectedDate , isAuthenticated , selectedLocation, setSelectedLocation}) => {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState(
    auth.currentUser ? { email: auth.currentUser.email, firstName: auth.currentUser.displayName || "User" } : null
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(!isAuthenticated && !auth.currentUser);  const dropdownRef = useRef(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log("Navbar: Auth state changed, user:", user);
      if (user) {
        const docRef = doc(db, "Users", user.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Navbar: User data from Firestore:", data);
            setUserDetails(data);
          } else {
            console.log("Navbar: No user document found for UID:", user.uid);
            setUserDetails({ email: user.email, firstName: user.displayName || "User" });
          }
          setIsDropdownOpen(false); // Close dropdown when authenticated
        } catch (error) {
          console.error("Navbar: Error fetching user data:", error.message);
          setUserDetails({ email: user.email, firstName: user.displayName || "User" });
          setIsDropdownOpen(false);
        }
      } else {
        console.log("Navbar: User is not logged in");
        setUserDetails(null);
        setIsDropdownOpen(true); // Open dropdown when unauthenticated
      }
    });

    return () => {
      console.log("Navbar: Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen((prevState) => !prevState);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && userDetails) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen, userDetails]);

  console.log("Navbar: userDetails:", userDetails);
  console.log("Navbar: isDropdownOpen:", isDropdownOpen);

  return (
    <div style={styles.navbar} className="flex items-center justify-center">
      <button style={styles.title} className="text-2xl font-semibold" onClick={() => navigate("/")}>
        The House Of Pool
      </button>
      <div className="flex items-center justify-center relative left-36">
        <Button type="link" style={styles.navButton} onClick={() => navigate("/")}>
          Home
        </Button>
        <Button type="link" style={styles.navButton} onClick={() => navigate("/inventory")}>
          Inventory
        </Button>
        <Button type="link" style={styles.navButton} onClick={() => navigate("/reports")}>
          Reports
        </Button>
        <Select
          value={selectedLocation}
          onChange={setSelectedLocation}
          style={{ width: 170}}
        >
          <Option value="Old House Of Pool">Old House Of Pool</Option>
          <Option value="New House Of Pool">New House Of Pool</Option>
        </Select>
      </div>

      <button onClick={toggleDropdown} className="relative left-36">
        <div className="flex flex-row items-center justify-center text-2xl h-10 w-24 bg-white rounded-3xl">
          {userDetails ? (
            <div className="flex justify-start items-center">
              {userDetails.photo ? (
                <img
                  src={userDetails.photo}
                  width="80%"
                  style={{ borderRadius: "50%" }}
                  className="flex top-4"
                  alt="Profile"
                />
              ) : (
                <div
                  style={{
                    width: "80%",
                    height: "80%",
                    borderRadius: "50%",
                    backgroundColor: "#ccc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {userDetails.firstName ? userDetails.firstName[0] : "U"}
                </div>
              )}
              <span className="font-light text-xs flex text-black pr-2">
                {userDetails.firstName}
              </span>
            </div>
          ) : (
            <div className="flex items-center">
              <CgProfile className="text-black ml-5" />
              <span className="font-light text-xs text-black ml-1">Login/SignUp</span>
            </div>
          )}
        </div>
      </button>
      <div style={styles.calendarContainer}>
        <h2 style={styles.heading}>📅 Select Date</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={styles.dateInput}
        />
      </div>

      {isDropdownOpen && (
        <>
          <div className="overlay fixed top-0 left-0 w-full h-full bg-zinc-900 opacity-50 z-10"></div>
          <div
            ref={dropdownRef}
            className="dropdown-menu absolute right-[28.5rem] top-[25vh] h-[26rem] w-[40rem] bg-white shadow-2xl rounded-3xl p-[6px] z-50 animate-slide-down flex items-center gap-2"
          >
            <div>
              <img src={logo1} className="h-[12.5rem] w-[30rem] rounded-t-3xl" alt="Logo 1" />
              <img src={logo2} className="h-[12.5rem] w-[30rem] rounded-b-3xl" alt="Logo 2" />
            </div>
            {userDetails ? (
              <div className="text-black">
                <Profile userDetails={userDetails} />
              </div>
            ) : (
              <div>
                <Register />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  navbar: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    background: "#001529",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    zIndex: 1000,
  },
  title: { margin: 0, color: "#fff" },
  navButton: { color: "#fff", fontSize: "16px", marginLeft: "15px" },
  calendarContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "15px",
  },
  heading: {
    color: "#fff",
    fontSize: "15px",
    fontWeight: "bold",
    marginTop: "10px",
  },
  dateInput: {
    padding: "5px 7px",
    fontSize: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    background: "rgba(255, 255, 255, 0.8)",
    color: "#333",
    outline: "none",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0px 2px 5px rgba(0, 0, 0, 0.1)",
  },
};

export default Navbar;