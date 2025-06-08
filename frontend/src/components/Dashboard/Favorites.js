import React from 'react';
import { Heart } from 'lucide-react';
import { useStock } from '../../context/StockContext';
import Header from '../Common/Header';
import Footer from '../Common/Footer';
import Card from '../UI/Card';
import StockList from './Stocklist';

const Favorites = () => {
  const { stocks } = useStock();
  
  // Filter only favorite stocks
  const favoriteStocks = stocks.filter(stock => stock.isFavorite);

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-dark-300">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Heart className="mr-3 h-6 w-6 text-yellow-500" />
            My Favorites
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Stocks you've marked as favorites for quick tracking
          </p>
        </div>

        {favoriteStocks.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <Heart className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No Favorite Stocks
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Add stocks to your favorites to see them here
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <StockList 
              stocks={favoriteStocks}
              onStockSelect={() => {}} // Placeholder 
              onAlertClick={() => {}} // Placeholder
              onFavoriteClick={() => {}} // Placeholder
            />
          </Card>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default Favorites;