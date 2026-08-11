'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useBuyerType } from '@/contexts/BuyerTypeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useStore } from '@/store/useStore';
import { useCompareStore } from '@/store/compareStore';
import PriceDisplay from '@/components/product/PriceDisplay';
import SeasonLabel from '@/components/product/SeasonLabel';
import StarRating from '@/components/product/StarRating';
import ReviewSection from '@/components/product/ReviewSection';
import RelatedProducts from '@/components/product/RelatedProducts';
import BestSellingProducts from '@/components/product/BestSellingProducts';
import RecommendedForYou from '@/components/product/RecommendedForYou';
import ActiveCampaignsStrip from '@/components/product/ActiveCampaignsStrip';
import QuotationModal from '@/components/product/QuotationModal';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { isProductVisibleToBuyer, isCampaignVisibleToBuyer } from '@/lib/utils';
import SpecialSectionComp from '@/components/home/SpecialSection';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ShoppingCart, MessageSquare, Phone, Mail, Share2, CheckCircle, Leaf, MapPin, Award, Calendar, Heart, GitCompareArrows, ZoomIn, Sprout } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

gsap.registerPlugin(ScrollTrigger);

export default function ProductDetailClient({ product, sections, activeCampaigns = [], relatedProducts = [], recommendedProducts = [], recommendedPersonalized = false, bestSellingProducts = [] }) {
  const { addItem } = useCart();
  const { buyerType, isLocal } = useBuyerType();
  const { settings } = useSettings();
  const { toggleWishlist, isWishlisted } = useStore();
  const { addToCompare, isInCompare, removeFromCompare } = useCompareStore();
  const { data: session } = useSession();
  const router = useRouter();
  const [qty, setQty] = useState(product.minimumOrderQuantity || 1);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const heroRef = useRef(null);
  const wishlisted = isWishlisted(product._id);

  // Issues 2/3/9 (batch 3) + issue 11 (batch 4): every list below is fetched server-side WITHOUT
  // buyer-type filtering (the server component can't see a guest's localStorage-only buyer-type
  // choice), so it must be filtered here — same pattern as HomeClientWrapper.jsx uses for the
  // homepage. Without the per-product check, a product restricted to local-only or
  // international-only buyers could leak into campaigns/special sections/related/recommended/
  // best-selling on every product's detail page regardless of who was viewing it. Without the
  // isCampaignVisibleToBuyer check, a campaign/section itself restricted to one buyer type (its own
  // targetAudience, separate from the products inside it) would still show to the other buyer type.
  const visibleSections = (sections || [])
    .filter(s => isCampaignVisibleToBuyer(s, buyerType))
    .map(s => ({ ...s, products: (s.products || []).filter(p => isProductVisibleToBuyer(p, buyerType)) }))
    .filter(s => s.products.length > 0);
  const visibleCampaigns = (activeCampaigns || [])
    .filter(c => isCampaignVisibleToBuyer(c, buyerType))
    .map(c => ({ ...c, items: (c.items || []).filter(i => isProductVisibleToBuyer(i.product, buyerType)) }))
    .filter(c => c.items.length > 0);
  const visibleRelated = (relatedProducts || []).filter(p => isProductVisibleToBuyer(p, buyerType));
  const visibleRecommended = (recommendedProducts || []).filter(p => isProductVisibleToBuyer(p, buyerType));
  const visibleBestSelling = (bestSellingProducts || []).filter(p => isProductVisibleToBuyer(p, buyerType));
  const inCompare = isInCompare(product._id);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.pdp-image', { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' });
      gsap.fromTo('.pdp-info > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out', delay: 0.2 });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  const images = product.images?.length ? product.images : ['https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=800&q=80'];
  const whatsappMsg = encodeURIComponent(`Hi Shah International, I'm interested in importing ${product.name}. Please share bulk pricing and availability.`);
  const contact = { phone: '+8801681896498', whatsapp: '8801681896498', email: 'shahinternational@gmail.com', ...(settings?.contact || {}) };
  const exportEmail = contact.exportEmail || contact.email;

  const handleShare = () => {
    if (navigator.share) navigator.share({ title: product.name, url: window.location.href });
    else { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }
  };

  const handleMessageUs = async () => {
    if (!session) { toast.error('Please login to send a message'); router.push(`/login?callbackUrl=/products/${product.slug}`); return; }
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: `Inquiry: ${product.name}`,
        body: `Hi, I'm interested in importing ${product.name}. Could you share more details on pricing, MOQ, and availability?`,
        productId: product._id,
        type: 'quotation',
      }),
    });
    const data = await res.json();
    if (data.success) { toast.success('Message sent! View it under "Messages".'); router.push(`/messages/${data.conversation._id}`); }
    else toast.error(data.message);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" ref={heroRef}>
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-brand">Home</Link><span>/</span>
        <Link href="/products" className="hover:text-brand">Products</Link><span>/</span>
        {product.category && <><Link href={`/categories/${product.category.slug}`} className="hover:text-brand">{product.category.name}</Link><span>/</span></>}
        <span className="text-gray-700 dark:text-gray-300">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
        {/* Images */}
        <div className="pdp-image">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-3 shadow-lg cursor-zoom-in group" onClick={() => setLightboxOpen(true)}>
            <Image src={images[activeImg]} alt={product.name} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" priority />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
              <div className="bg-white/80 backdrop-blur-sm rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="w-5 h-5 text-gray-700" />
              </div>
            </div>
            {!product.isHarvestingSeason && (
              <div className="absolute bottom-4 left-4">
                <div className="bg-amber-500 text-white px-4 py-2 rounded-xl font-semibold text-sm rotate-[-2deg] shadow-lg">⏰ Pre-Order</div>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === activeImg ? 'border-brand scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                  <Image src={img} alt="" width={64} height={64} className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 text-center mt-2">Click image to zoom</p>
        </div>

        {/* Info */}
        <div className="pdp-info space-y-4">
          <div className="flex items-start justify-end gap-2">
            <button onClick={() => { if (inCompare) removeFromCompare(product._id); else addToCompare(product); }} className={`p-2 rounded-xl border transition-all text-sm ${inCompare ? 'bg-brand text-white border-transparent' : 'border-gray-200 text-gray-400 hover:border-brand hover:text-brand'}`} title="Compare">
              <GitCompareArrows className="w-4 h-4" />
            </button>
            <button onClick={() => { toggleWishlist(product); toast.success(wishlisted ? 'Removed from wishlist' : '❤️ Added to wishlist!'); }} className={`p-2 rounded-xl border transition-all ${wishlisted ? 'bg-red-500 border-red-500 text-white' : 'border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-400'}`}>
              <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
            <button onClick={handleShare} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:border-gray-300 transition-all"><Share2 className="w-4 h-4" /></button>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>{product.name}</h1>
            {(product.scientificName || product.localName) && (
              <p className="text-gray-400 italic text-sm mb-2">
                ({[product.scientificName, product.localName].filter(Boolean).join(' · ')})
              </p>
            )}
            {/* Issue 6: organic-certified / featured badges live under the product name (not on the
                image, which previously overlaid isOrganic in the top-right corner of the gallery). */}
            <div className="flex flex-wrap gap-2">
              <SeasonLabel isHarvestingSeason={product.isHarvestingSeason} harvestingSeason={product.harvestingSeason} size="md" />
              {product.isFeatured && <Badge variant="primary">⭐ Featured</Badge>}
              {product.isOrganic && <Badge variant="success">🌿 Organic Certified</Badge>}
            </div>
          </div>

          {product.reviewCount > 0 && (
            <div className="flex items-center gap-2">
              <StarRating rating={product.averageRating || 0} size="md" />
              <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm">{product.averageRating?.toFixed(1)}</span>
              <a href="#reviews" className="text-brand text-sm hover:underline">({product.reviewCount} reviews)</a>
            </div>
          )}

          <PriceDisplay product={product} size="xl" />

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: MapPin, label: 'Origin', value: product.countryOfOrigin },
              { icon: Leaf, label: 'Location', value: product.harvestingLocation },
              { icon: Calendar, label: 'Season', value: product.harvestingSeason },
              { icon: Award, label: 'Min. Order', value: `${product.minimumOrderQuantity || 1} ${product.unit}` },
              ...(product.isOrganic ? [{ icon: Sprout, label: 'Certification', value: 'Organic Certified' }] : []),
              ...(product.shelfLife ? [{ icon: CheckCircle, label: 'Shelf Life', value: `${product.shelfLife} day${product.shelfLife === 1 ? '' : 's'}` }] : []),
            ].filter(i => i.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">
                <Icon className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                <div><p className="text-xs text-gray-400">{label}</p><p className="text-sm font-semibold text-gray-800 dark:text-white">{value}</p></div>
              </div>
            ))}
          </div>

          {product.certifications?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Certifications</p>
              <div className="flex flex-wrap gap-2">
                {product.certifications.map((c, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium border border-green-200 dark:border-green-800">
                    <CheckCircle className="w-3.5 h-3.5" />{c.name}{c.issuer && <span className="text-green-400">({c.issuer})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isLocal ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <button onClick={() => setQty(Math.max(product.minimumOrderQuantity || 1, qty - 1))} className="px-4 py-3 text-xl font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">−</button>
                  <span className="px-4 py-3 font-bold text-gray-900 dark:text-white min-w-[50px] text-center">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="px-4 py-3 text-xl font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">+</button>
                </div>
                <span className="text-sm text-gray-400">{product.unit}</span>
              </div>
              <Button variant="primary" size="lg" className="w-full" icon={ShoppingCart} onClick={() => addItem(product, qty, !product.isHarvestingSeason)}>
                {product.isHarvestingSeason ? `Add ${qty} ${product.unit} to Cart` : 'Pre-Order Now'}
              </Button>
              {!product.isHarvestingSeason && product.allowPreOrder && (
                <p className="text-xs text-amber-600 text-center bg-amber-50 dark:bg-amber-900/20 rounded-xl py-2 px-3">
                  ⏰ Ships when in season: {product.harvestingSeason || 'next harvest'}
                </p>
              )}
            </div>
          ) : (
            <div id="quotation" className="space-y-3 pt-2">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">🌍 Available for International Import</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">HACCP certified · Custom packaging · Phytosanitary docs · Global logistics</p>
              </div>
              <Button variant="primary" size="lg" className="w-full" icon={MessageSquare} onClick={() => setShowQuote(true)}>Request Import Quotation</Button>
              <div className="grid grid-cols-2 gap-3">
                <a href={`https://wa.me/${contact.whatsapp}?text=${whatsappMsg}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-xl text-white bg-[#25D366] hover:bg-[#22c55e] text-sm font-semibold transition-all">
                  💬 WhatsApp
                </a>
                <a href={`mailto:${exportEmail}`} className="flex items-center justify-center gap-2 py-3 rounded-xl text-white bg-blue-600 hover:bg-blue-700 text-sm font-semibold transition-all">
                  <Mail className="w-4 h-4" /> Email
                </a>
              </div>
              <a href={`tel:${contact.phone}`} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all w-full">
                <Phone className="w-4 h-4" /> {contact.phone}
              </a>
              <button onClick={handleMessageUs} className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium hover:border-brand hover:text-brand transition-all w-full">
                <MessageSquare className="w-4 h-4" /> Send a Direct Message on the Site
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Product Description</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">{product.description}</p>
          </div>
          <div className="space-y-4">
            {product.storageInstructions && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm mb-1.5">💡 Storage Instructions</p>
                <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">{product.storageInstructions}</p>
              </div>
            )}
            {product.packagingOptions?.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                <p className="font-semibold text-blue-800 dark:text-blue-300 text-sm mb-2">📦 Packaging Options</p>
                {product.packagingOptions.map((o, i) => <p key={i} className="text-blue-700 dark:text-blue-300 text-sm">• {o}</p>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Special sections (campaigns) — a product CAN legitimately repeat across different
          campaigns here (different discount/badge/metrics each time), so these don't exclude
          each other. Everything below excludes anything used here. Filtered by buyer type
          (issues 2/3/9) — see visibleSections above. */}
      {visibleSections.map(s => <SpecialSectionComp key={s._id} section={s} />)}

      {/* Active flash-sale campaigns featuring other products (pre-filtered server-side against
          everything already shown above, and by buyer type client-side — issues 2/3/9) */}
      <ActiveCampaignsStrip campaigns={visibleCampaigns} />

      {/* Related products in the same category (pre-filtered, pre-deduped, buyer-type filtered) */}
      <RelatedProducts products={visibleRelated} categoryId={product.category?._id} currentProductId={product._id} />

      {/* Personalized recommendations (pre-filtered, pre-deduped, buyer-type filtered) */}
      <RecommendedForYou products={visibleRecommended} personalized={recommendedPersonalized} />

      {/* Real best-sellers, computed from delivered order data (pre-filtered, pre-deduped, buyer-type filtered) */}
      <BestSellingProducts products={visibleBestSelling} />


      {/* Reviews */}
      <div id="reviews"><ReviewSection productId={product._id} /></div>

      {/* Lightbox */}
      <ImageLightbox images={images} initialIndex={activeImg} isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      <QuotationModal isOpen={showQuote} onClose={() => setShowQuote(false)} product={product} />
    </div>
  );
}
