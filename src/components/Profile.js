import React, { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import Login from "./Login";

function Profile() {
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data and listen to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log("Profile: Auth state changed, user:", user);
      if (user) {
        const docRef = doc(db, "Users", user.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            userData.uid = user.uid; // Add uid from Firebase Auth
            console.log("Profile: User data from Firestore:", userData);
            setUserDetails(userData);
          } else {
            console.log("Profile: No user document found in Firestore for UID:", user.uid);
            // Fallback to auth data if no Firestore document
            setUserDetails({
              email: user.email,
              firstName: user.displayName || "User",
              uid: user.uid,
              photo: user.photoURL || null, // Can be null if no photo
            });
          }
        } catch (error) {
          console.error("Profile: Error fetching user data:", error.message);
          // Fallback if permission denied or other error
          setUserDetails({
            email: user.email,
            firstName: user.displayName || "User",
            uid: user.uid,
            photo: user.photoURL || null,
          });
        }
      } else {
        console.log("Profile: User not logged in!");
        setUserDetails(null);
      }
      setLoading(false); // Set loading to false after checking auth state
    });

    return () => {
      console.log("Profile: Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  async function handleLogout() {
    try {
      setLoading(true);
      await auth.signOut();
      console.log("Profile: User logged out successfully!");
      setUserDetails(null);
      setLoading(false);
    } catch (error) {
      console.error("Profile: Error logging out:", error.message);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-100  h-[19rem] md:h-[25rem] w-[13rem] md:w-[19rem] text-black rounded-3xl shadow-xl shadow-gray-400">
        <div className="flex items-center gap-4">
          <p className="text-black font-medium text-2xl">Loading...</p>
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.964 7.964 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div>
      {userDetails ? (
        <div className="bg-gray-100 md:h-[25rem] h-[19rem] md:w-[19rem] w-[13rem] text-black rounded-3xl shadow-xl shadow-gray-400 flex flex-col items-center justify-start ">
          <div className="flex mt-1  w-60">
            <span className="text-3xl font-bold text-black text-center">The House Of Pool</span>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            {userDetails.photo ? (
              <img
                src={userDetails.photo}
                width={"30%"}
                style={{ borderRadius: "50%" }}
                alt="User"
              />
            ) : (
              <div
                style={{
                  width: "30%",
                  height: "30%",
                  borderRadius: "50%",
                  backgroundColor: "#ccc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "20px",
                }}
              >
                {userDetails.firstName ? userDetails.firstName[0] : "U"}
              </div>
            )}
          </div>
          <h3 className="mx-8 mt-2 font-semibold text-lg whitespace-nowrap">
            Welcome {userDetails.firstName} 🙏🙏
          </h3>
          <div className="mx-10 mt-2 flex flex-col items-center justify-center">
            <p className="whitespace-nowrap">Email: {userDetails.email}</p>
            <p>Name: {userDetails.firstName}</p>
          </div>
          <button
            className="mt-2 flex items-center justify-center h-7 md:w-48 w-36 bg-blue-600 rounded-lg text-white mx-8"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <Login />
      )}
    </div>
  );
}

export default Profile;
