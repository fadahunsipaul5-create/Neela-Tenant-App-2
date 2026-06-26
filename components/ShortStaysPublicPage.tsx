import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ShortStayPortal from './ShortStayPortal';

const ShortStaysPublicPage: React.FC = () => {
  const navigate = useNavigate();
  const { propertyId } = useParams<{ propertyId?: string }>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30">
      <ShortStayPortal
        onBack={() => navigate('/')}
        initialPropertyId={propertyId}
        onPropertyChange={(id) => {
          if (id) navigate(`/short-stays/${id}`, { replace: true });
          else navigate('/short-stays', { replace: true });
        }}
      />
    </div>
  );
};

export default ShortStaysPublicPage;
