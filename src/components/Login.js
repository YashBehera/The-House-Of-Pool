import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import { auth } from "./firebase";
import { toast } from "react-toastify";

import Profile from "./Profile";


function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showProfile, setShowProfile] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowProfile(true);
      console.log("User logged in Successfully");
      toast.success("User logged in Successfully", {
        position: "top-center",
      });
    } catch (error) {
      console.log(error.message);

      toast.error(error.message, {
        position: "bottom-center",
      });
    }
  };



  return (
    <>
      {showProfile ? (
        <div>
          <Profile />
        </div>
      ) : (
        <div className="bg-gray-100 md:h-[25rem] h-[19rem] md:w-full w-full text-black rounded-3xl shadow-xl shadow-gray-400 flex flex-col items-center justify-start ">
          <div className="flex mt-1  w-60">
            <span className="text-3xl font-bold text-black text-center">The House Of Pool</span>
          </div>
          <div>
            <form onSubmit={handleSubmit} className="flex flex-col justify-center items-center">
              <h3 className="font-semibold text-lg mt-0">Login</h3>

              <div className="mb-1 gap-0 text-sm">
                <label className="text-base font-medium">Email address</label><br />
                <input
                  type="email"
                  className="form-control border-2 border-solid rounded-lg px-1 w-48 focus:outline-none"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-1 gap-0 text-sm">
                <label className="text-base font-medium">Password</label><br />
                <input
                  type="password"
                  className="form-control border-2 border-solid rounded-lg px-1 w-48 focus:outline-none"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button className=" flex items-center justify-center h-7 md:w-48 w-36 bg-blue-600 rounded-lg text-white mt-2">
                <div type="submit" className="btn btn-primary">
                  <span className="flex items-center justify-center">
                    Login
                  </span>
                </div>
              </button>
              {/*               <p className="forgot-password text-right text-xs mt-1">
                New Register?{" "}
                <button
                  type="button"
                  className="text-blue-600"
                  onClick={handleRegisterClick}
                >
                  Register Here
                </button>
              </p> */}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Login;
