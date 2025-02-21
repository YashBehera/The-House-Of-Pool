import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "./firebase";
import { setDoc, doc } from "firebase/firestore";
import { toast } from "react-toastify";
import Login from "./Login";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [showLogin, setShowLogin] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // Step 1: Create the user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user; // Use userCredential.user for consistency
      console.log("User created:", user);

      // Step 2: Write user data to Firestore
      if (user) {
        await setDoc(doc(db, "Users", user.uid), {
          email: user.email,
          firstName: fname,
          lastName: lname,
          photo: "",
        });
        console.log("User data written to Firestore");
      }

      // Step 3: Success feedback
      console.log("User Registered Successfully!!");
      toast.success("User Registered Successfully!!", {
        position: "top-center",
      });
      setShowLogin(true);
    } catch (error) {
      console.error("Registration error:", error.code, error.message);
      toast.error(error.message, {
        position: "bottom-center",
      });
    }
  };

  const handleLoginClick = () => {
    setShowLogin(true);
  };

  return (
    <>
      {showLogin ? (
        <div>
          <Login />
        </div>
      ) : (
        <div className="bg-gray-100 h-[25rem] w-[19rem] text-black rounded-3xl shadow-xl shadow-gray-400 justify-center items-center">
          <div className="flex mt-1 ml-10 w-60">
            <span className="text-3xl font-bold text-black text-center">The House Of Pool</span>
          </div>
          <div>
            <form onSubmit={handleRegister} className="flex flex-col items-center justify-center">
              <h3 className="font-semibold text-lg mt-0">Sign Up</h3>

              <div className="mb-1 gap-0 text-sm">
                <label className="text-base font-medium">First name</label>
                <br />
                <input
                  type="text"
                  className="form-control border-2 border-solid rounded-lg px-1 w-48 focus:outline-none"
                  placeholder="First name"
                  onChange={(e) => setFname(e.target.value)}
                  required
                />
              </div>
              <div className="mb-1 gap-0 text-sm">
                <label className="text-base font-medium">Last name</label>
                <br />
                <input
                  type="text"
                  className="form-control border-2 border-solid rounded-lg px-1 w-48 focus:outline-none"
                  placeholder="Last name"
                  onChange={(e) => setLname(e.target.value)}
                />
              </div>

              <div className="mb-1 gap-0 text-sm">
                <label className="text-base font-medium">Email address</label>
                <br />
                <input
                  type="email"
                  className="form-control border-2 border-solid rounded-lg px-1 w-48 focus:outline-none"
                  placeholder="Enter email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-1 gap-0 text-sm">
                <label className="text-base font-medium">Password</label>
                <br />
                <input
                  type="password"
                  className="form-control border-2 border-solid rounded-lg px-1 w-48 focus:outline-none"
                  placeholder="Enter password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button className="flex items-center justify-center h-7 w-48 bg-blue-600 rounded-lg text-white">
                <div type="submit" className="btn btn-primary">
                  <span className="flex items-center justify-center">Sign Up</span>
                </div>
              </button>
              <p className="forgot-password text-right text-xs mt-1">
                Already registered?{" "}
                <button type="button" className="text-blue-600" onClick={handleLoginClick}>
                  Login
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Register;