import React from 'react';
import { OrderList } from '../orders/OrderList';
import { NewOrderModal } from '../orders/NewOrderModal';
import { OrderDetailsModal } from '../orders/OrderDetailsModal';

export const OrdersPage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <OrderList />
      <NewOrderModal />
      <OrderDetailsModal />
    </div>
  );
};
