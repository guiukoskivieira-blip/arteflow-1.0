import React from 'react';
import { OrderList } from '../orders/OrderList';

export const OrdersPage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <OrderList />
    </div>
  );
};
