import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    window.location.href = "/aria.html";
  }, []);

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: "#06040e", color: "#ede8f5", fontFamily: "'Rajdhani', sans-serif" }}
    >
      <p style={{ letterSpacing: "0.25em", fontSize: "14px", opacity: 0.5 }}>
        Loading ARIA...
      </p>
    </div>
  );
};

export default Index;
