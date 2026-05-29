/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BLOG_POSTS, BlogPost } from '../data/blogPosts';
import { FileText, ShieldAlert, Users, Calendar, ArrowLeft, BookOpen, Compass } from 'lucide-react';

interface AdsenseDocPagesProps {
  currentSubpage: 'blog' | 'about' | 'privacy' | 'terms';
  setCurrentSubpage: (page: 'blog' | 'about' | 'privacy' | 'terms' | null) => void;
}

export default function AdsenseDocPages({ currentSubpage, setCurrentSubpage }: AdsenseDocPagesProps) {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const handlePostClick = (post: BlogPost) => {
    setSelectedPost(post);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToBlog = () => {
    setSelectedPost(null);
  };

  return (
    <div id="adsense-pages-container" className="bg-white border border-[#E2E2E9] rounded-xl shadow-xs py-8 px-6 md:p-10 max-w-5xl mx-auto my-6 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#E2E2E9] mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button
            id="back-to-scanner-btn"
            onClick={() => setCurrentSubpage(null)}
            className="p-2 border border-[#E2E2E9] rounded-lg text-[#64748B] hover:text-[#1A1A1E] hover:bg-slate-50 transition"
            title="Return to scanner dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-2xl font-black text-[#1A1A1E] tracking-tight uppercase">
              {currentSubpage === 'blog' ? 'Trading Academy' : 
               currentSubpage === 'about' ? 'About Our Technology' : 
               currentSubpage === 'privacy' ? 'Privacy & Cookie Consent' : 'Terms & Disclaimers'}
            </h2>
            <p className="text-xs text-[#64748B] mt-1 font-sans">
              Official regulatory documents & technical reviews required for publication.
            </p>
          </div>
        </div>

        {/* Directory Navigator Tabs */}
        <div className="flex flex-wrap gap-1 bg-[#F1F5F9] p-1 border border-[#E2E8F0] rounded-lg self-start sm:self-center">
          <button
            onClick={() => { setCurrentSubpage('blog'); setSelectedPost(null); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              currentSubpage === 'blog' ? 'bg-white text-[#1A1A1E] shadow-xs' : 'text-[#64748B] hover:text-[#1A1A1E]'
            }`}
          >
            Blog
          </button>
          <button
            onClick={() => setCurrentSubpage('about')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              currentSubpage === 'about' ? 'bg-white text-[#1A1A1E] shadow-xs' : 'text-[#64748B] hover:text-[#1A1A1E]'
            }`}
          >
            About Us
          </button>
          <button
            onClick={() => setCurrentSubpage('privacy')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              currentSubpage === 'privacy' ? 'bg-white text-[#1A1A1E] shadow-xs' : 'text-[#64748B] hover:text-[#1A1A1E]'
            }`}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => setCurrentSubpage('terms')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              currentSubpage === 'terms' ? 'bg-white text-[#1A1A1E] shadow-xs' : 'text-[#64748B] hover:text-[#1A1A1E]'
            }`}
          >
            Terms of Use
          </button>
        </div>
      </div>

      {/* Render Subpage Content */}
      <div id="subpage-viewport" className="min-h-[400px]">
        
        {/* ============ BLOG SUBPAGE ============ */}
        {currentSubpage === 'blog' && (
          <div>
            {selectedPost ? (
              // Individual Article Viewer
              <article className="prose max-w-3xl mx-auto">
                <button
                  id="btn-blog-back"
                  onClick={handleBackToBlog}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 mb-6 group transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5 transform group-hover:-translate-x-1 transition-transform" />
                  Back to Articles
                </button>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                    {selectedPost.category}
                  </span>
                  <span className="text-[#64748B] text-xs font-mono">{selectedPost.date}</span>
                </div>

                <h1 className="text-2xl md:text-3.5xl font-extrabold text-[#1A1A1E] tracking-tight leading-tight mb-4">
                  {selectedPost.title}
                </h1>

                <div className="flex items-center gap-3 py-3 border-y border-[#F1F5F9] my-6 text-xs text-[#64748B]">
                  <span className="font-semibold text-[#1A1A1E]">By {selectedPost.author}</span>
                  <span>&bull;</span>
                  <span>{selectedPost.readTime}</span>
                </div>

                <img
                  src={selectedPost.image}
                  alt={selectedPost.title}
                  className="w-full h-64 md:h-96 object-cover rounded-xl border border-[#E2E2E9] mb-8"
                  referrerPolicy="no-referrer"
                />

                <div className="space-y-6 text-[#334155] leading-relaxed text-md font-normal">
                  {selectedPost.content.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>

                {/* Structured Financial Content Notice */}
                <div className="bg-[#F8FAFC] border border-[#E2E2E9] p-5 rounded-xl font-sans mt-12">
                  <h4 className="text-xs font-bold text-[#1A1A1E] flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                    General Risk Disclaimer
                  </h4>
                  <p className="text-[11px] text-[#64748B] leading-relaxed mt-1.5">
                    Trading digital commodities and assets involves high market volatility, exposure risks, and unexpected price adjustments. The analytical models, wick tolerance systems, and training material published on this scanner are purely for financial education and do not constitute certified or personal investment advice.
                  </p>
                </div>
              </article>
            ) : (
              // Blog Posts Grid List
              <div className="space-y-8">
                <div className="text-center max-w-xl mx-auto mb-10">
                  <BookOpen className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                  <h3 className="text-xl font-bold text-[#1A1A1E]">Candlestick & Technical Resources</h3>
                  <p className="text-xs text-[#64748B] mt-1">
                    Read original, ad-friendly articles tailored to optimize your trading metrics using Japanese charts.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {BLOG_POSTS.map(post => (
                    <div
                      id={`blog-card-${post.id}`}
                      key={post.id}
                      onClick={() => handlePostClick(post)}
                      className="bg-[#F8FAFC] hover:bg-white border border-[#E2E2E9] hover:border-slate-300 hover:shadow-xs rounded-xl p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between h-full"
                    >
                      <div>
                        <img
                          src={post.image}
                          alt={post.title}
                          className="w-full h-40 object-cover rounded-lg border border-[#E2E2E9] mb-4"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                            {post.category}
                          </span>
                          <span className="text-[#94A3B8] text-[10px] font-mono">{post.date}</span>
                        </div>
                        <h4 className="text-sm font-bold text-[#1A1A1E] leading-snug group-hover:text-blue-600 transition">
                          {post.title}
                        </h4>
                        <p className="text-[#64748B] text-xs leading-relaxed mt-2 line-clamp-3">
                          {post.excerpt}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-4 mt-4 border-t border-[#E2E2E9]/60">
                        <span className="font-semibold text-[#64748B]">By {post.author.split(',')[0]}</span>
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ ABOUT US SUBPAGE ============ */}
        {currentSubpage === 'about' && (
          <div className="prose max-w-3xl mx-auto space-y-6 text-[#334155] leading-relaxed">
            <div className="text-center max-w-xl mx-auto mb-10">
              <Users className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <h3 className="text-xl font-bold text-[#1A1A1E]">About Marubozu Scan Terminal</h3>
              <p className="text-xs text-[#64748B] mt-1">
                Founded to provide clean, unmanipulated momentum indexes to retail day traders worldwide.
              </p>
            </div>

            <h4 className="text-[#1A1A1E] font-bold text-md uppercase tracking-wider border-b border-[#F1F5F9] pb-1.5">Who We Are</h4>
            <p className="text-xs">
              Welcome to <strong>Marubozu Scan Terminal</strong>, an advanced analytical platform specializing in instant detection of standard high-volume crypto tokens. Utilizing low-latency stream servers connected with global cryptocurrency database networks, we compute candle bodies and wick tolerance factors mathematically inside browser threads, removing standard chart-delay bottlenecks.
            </p>

            <h4 className="text-[#1A1A1E] font-bold text-md uppercase tracking-wider border-b border-[#F1F5F9] pb-1.5 mt-6">Our Core Technology</h4>
            <p className="text-xs">
              Unlike traditional scanning agencies that charge premium subscription fees for simple alert queries, Marubozu Scan Terminal was built on open-source principles. Our proprietary Wick Tolerance Engine permits granular filtering to offset standard micro-rejection volatility typical of cryptocurrency order queues. Our background crawlers cycle and analyze millions of data points, ensuring our statistics are backed by strict historical data streams.
            </p>

            <h4 className="text-[#1A1A1E] font-bold text-md uppercase tracking-wider border-b border-[#F1F5F9] pb-1.5 mt-6">Editorial Integrity</h4>
            <p className="text-xs">
              In cooperation with Google AdSense terms and general financial compliance guidelines, we maintain full editorial oversight on all blog training articles. No content on our portal is generated via low-quality scraping mechanics. We employ real certified technical analysts to build clear, educational breakdowns of Japanese charts.
            </p>
          </div>
        )}

        {/* ============ PRIVACY POLICY SUBPAGE ============ */}
        {currentSubpage === 'privacy' && (
          <div className="prose max-w-3xl mx-auto space-y-6 text-[#334155] leading-relaxed text-xs">
            <div className="text-center max-w-xl mx-auto mb-10">
              <FileText className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <h3 className="text-xl font-bold text-[#1A1A1E]">Privacy Policy & Cookie Disclosures</h3>
              <p className="text-xs text-[#64748B] mt-1">
                Last Updated: May 29, 2026. Review our commitment to user transparency and tracking policies.
              </p>
            </div>

            <p>
              At Crypto Marubozu Scanner, accessible from our portal, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by our platform and how we use it.
            </p>

            <h4 className="font-bold text-[#1A1A1E] text-md mt-6 pb-1 border-b border-[#F1F5F9]">Google DoubleClick DART Cookies & Third-Party Advertisers</h4>
            <p>
              Google is one of the third-party vendors on our site. It also uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to our domain and other sites on the internet. However, visitors may choose to decline the use of DART cookies by visiting the Google ad and content network Privacy Policy at the following URL - <a href="https://policies.google.com/technologies/ads" className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">https://policies.google.com/technologies/ads</a>
            </p>

            <h4 className="font-bold text-[#1A1A1E] text-md mt-6 pb-1 border-b border-[#F1F5F9]">Information We Collect & Analytical Data Log Files</h4>
            <p>
              We follow a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this as part of hosting services' analytics. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users' movement on the website, and gathering demographic information.
            </p>

            <h4 className="font-bold text-[#1A1A1E] text-md mt-6 pb-1 border-b border-[#F1F5F9]">Consent and Advertising Partners</h4>
            <p>
              By using our website, you hereby consent to our Privacy Policy and agree to its terms. Advertisers like Google AdSense require verification that cookies are used respectfully. Disabling cookies can be configured independently through your browser setting panel.
            </p>
          </div>
        )}

        {/* ============ TERMS & CONDITIONS SUBPAGE ============ */}
        {currentSubpage === 'terms' && (
          <div className="prose max-w-3xl mx-auto space-y-6 text-[#334155] leading-relaxed text-xs">
            <div className="text-center max-w-xl mx-auto mb-10">
              <ShieldAlert className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <h3 className="text-xl font-bold text-[#1A1A1E]">Terms of Service & Regulatory Use</h3>
              <p className="text-xs text-[#64748B] mt-1">
                Last Updated: May 29, 2026. Important disclaimers regarding statistical scanning models.
              </p>
            </div>

            <p>
              By accessing this website, we assume you accept these terms and conditions in full. Do not continue to use Crypto Marubozu Scanner if you do not agree to all of the terms and conditions stated on this page.
            </p>

            <h4 className="font-bold text-[#1A1A1E] text-md mt-6 pb-1 border-b border-[#F1F5F9]">Disclaimer of Financial Advice (No Advice Provided)</h4>
            <p className="bg-[#FEF2F2] border border-[#FEE2E2] p-4 text-[#991B1B] rounded-lg font-sans">
              THIS SERVICE AND THE DATA DISPLAYED ON THIS SITE ARE FOR EDUCATIONAL AND STUDY PURPOSES ONLY. THERE ARE NO STRATEGIES DECLARED HEREIN WHICH CONSTITUTE AN ASSURED PROFIT SPECULATION OR LICENSED SECURITY RECOMMENDATION. MARUBOZU SCANTERMINAL DECLINES ANY INTEGRAL RESPONSIBILITY IN FINANCING DEFICITS RESULTING FROM ACTIONS TAKEN BY READERS PURSUANT TO THESE STATISTICAL ANALYTICS.
            </p>

            <h4 className="font-bold text-[#1A1A1E] text-md mt-6 pb-1 border-b border-[#F1F5F9]">Rules of Platform Use</h4>
            <p>
              Users are strictly forbidden from executing automated scraper scripts, web crawling bots, or high-velocity denial attacks against our public backend endpoints. Scraping CoinGecko's embedded framework via our server breaches standard fair-use agreements and will lead to an immediate, permanent IP block from our server relays.
            </p>

            <h4 className="font-bold text-[#1A1A1E] text-md mt-6 pb-1 border-b border-[#F1F5F9]">Limitation of Liability</h4>
            <p>
              In no event shall the domain owners or development partners be liable for any special, direct, indirect, consequential, or incidental damages arising out of or in connection with the use of the Service or the contents of the Service. We reserve the rights to modify, suspend, or update our cached pool structure without prior physical notice.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
