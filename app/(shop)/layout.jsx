import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import CompareBar from '@/components/product/CompareBar';

export default function ShopLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 page-enter pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
      <CompareBar />
    </div>
  );
}
