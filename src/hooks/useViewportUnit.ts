import { useEffect } from "react";

// Hook to set CSS custom properties for dynamic viewport units
// This handles the issue where mobile browsers shrink the viewport when the keyboard appears
export function useViewportUnit() {
  useEffect(() => {
    const setViewportProperty = () => {
      // Calculate the actual viewport height, accounting for address bar and keyboard
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
      
      // Set the full viewport height as well
      document.documentElement.style.setProperty("--full-vh", `${window.innerHeight}px`);
    };

    // Initialize on mount
    setViewportProperty();
    
    // Recalculate when resize occurs (which happens when keyboard appears/disappears)
    window.addEventListener("resize", setViewportProperty);
    
    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener("resize", setViewportProperty);
    };
  }, []);
}