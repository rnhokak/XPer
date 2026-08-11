import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TradingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/trading/dashboard', { replace: true });
  }, [navigate]);

  return null;
}
