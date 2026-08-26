import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import logo from "../assets/mb-logo.jpg";

export default function Login(){

    const [email,setEmail] = useState("");
    const [password,setPassword] = useState("");
    const [loading,setLoading] = useState(false);
    const [error,setError] = useState("");

    const navigate = useNavigate();


    async function handleLogin(e){

        e.preventDefault();
        setError("");
        setLoading(true);

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });


        if(authError){

            setError("Invalid email or password.");

        }else{

            navigate("/sectors");

        }

        setLoading(false);

    }


    return (

        <div className="min-h-screen bg-[#F4F4F4] flex items-center justify-center">


            <div className="w-full max-w-md">


                {/* Logo / Title */}

                <div className="text-center mb-8 flex flex-col items-center">

<img
    src={logo}
    alt="MB Development Corporation"
    className="w-36 h-36 object-contain drop-shadow-lg mb-2"
/>

  <h1 className="text-3xl font-bold text-[#2E2E2E]">
    MB Development Corporation
  </h1>

  <p className="text-[#6D6D6D] mt-2">
    Field Order Management System
  </p>

</div>



                {/* Login Card */}

                <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#D9D9D9]">


                    <h2 className="text-xl font-semibold text-slate-800 mb-6">
                        Welcome Back
                    </h2>



                    <form onSubmit={handleLogin} className="space-y-4">

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}


                        <div>

                            <label className="text-sm text-slate-600">
                                Email
                            </label>


                            <input

                            type="email"

                            className="
                            w-full mt-1 px-4 py-3
                            border border-slate-300
                            rounded-lg
                            focus:outline-none
                            focus:ring-2
                            focus:ring-[#D89B00]
                            "

                            placeholder="Enter your email"

                            onChange={(e)=>setEmail(e.target.value)}

                            />

                        </div>



                        <div>

                            <label className="text-sm text-slate-600">
                                Password
                            </label>


                            <input

                            type="password"

                            className="
                            w-full mt-1 px-4 py-3
                            border border-slate-300
                            rounded-lg
                            focus:outline-none
                            focus:ring-2
                            focus:ring-[#D89B00]
                            "

                            placeholder="Enter your password"

                            onChange={(e)=>setPassword(e.target.value)}

                            />

                        </div>



                        <button

                        type="submit"

                        disabled={loading}

                        className="w-full bg-[#D89B00] hover:bg-[#C58A00] text-white py-3 
                        rounded-lg
                        flex
                        items-center
                        justify-center
                        gap-2
                        transition
                        "

                        >


                        <LogIn size={18}/>


                        {loading ? "Logging in..." : "Login"}


                        </button>


                    </form>


                </div>


                <p className="text-center text-sm text-slate-400 mt-6">

                Company Management System

                </p>


            </div>


        </div>

    )

}