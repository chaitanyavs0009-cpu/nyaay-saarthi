import { Phone, ExternalLink, ShieldCheck } from 'lucide-react';
import { FOOTER_PLATFORM_LINKS, FOOTER_RIGHTS_LINKS, FOOTER_GOVT_LINKS } from '../data/content';
import { Language, FooterLink } from '../types';
import logoImg from '../assets/images/nyaay_sarathi_logo_1787153284213.jpg';

interface FooterProps {
  language: Language;
  onActionClick: (action: string, title?: string, linkData?: FooterLink) => void;
}

export function Footer({ language, onActionClick }: FooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer id="main-footer" className="relative bg-slate-900/95 backdrop-blur-xl text-slate-200 py-5 sm:py-6 border-t border-white/15 shadow-[0_-4px_24px_rgba(15,23,42,0.4)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Compact Header: Branding & Helpline Badges */}
        <div className="pb-3.5 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-3.5 cursor-pointer group" onClick={scrollToTop}>
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/95 backdrop-blur-md p-1 shadow-md border border-white/90 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-200">
              <img 
                src={logoImg} 
                alt="Nyaay Sarthi Logo" 
                className="w-full h-full object-cover rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                  <span className="font-bold text-white">Nyaay</span> <span className="text-sky-400 font-bold">Sarthi</span>
                </span>
                <span className="hidden sm:inline-block text-[11px] text-sky-300/80 border-l border-white/20 pl-2">
                  {language === 'en' ? 'Citizen Legal Assistance' : 'नागरिक कानूनी सहायता'}
                </span>
              </div>
            </div>
          </div>

          {/* Essential Citizen Helplines - Compact Badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <a 
              href="tel:1930" 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/15 text-[11px] hover:bg-white/15 text-slate-200 hover:text-white transition-all shadow-xs"
              title="National Cyber Crime Reporting Helpline"
            >
              <Phone className="w-3 h-3 text-sky-400" />
              <span className="text-sky-200/90 font-medium">Cyber:</span>
              <strong className="text-white font-mono font-bold">1930</strong>
            </a>
            <a 
              href="tel:15100" 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/15 text-[11px] hover:bg-white/15 text-slate-200 hover:text-white transition-all shadow-xs"
              title="NALSA Free Legal Aid Helpline"
            >
              <Phone className="w-3 h-3 text-sky-400" />
              <span className="text-sky-200/90 font-medium">NALSA Aid:</span>
              <strong className="text-white font-mono font-bold">15100</strong>
            </a>
            <a 
              href="tel:1915" 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/15 text-[11px] hover:bg-white/15 text-slate-200 hover:text-white transition-all shadow-xs"
              title="National Consumer Helpline"
            >
              <Phone className="w-3 h-3 text-sky-400" />
              <span className="text-sky-200/90 font-medium">Consumer:</span>
              <strong className="text-white font-mono font-bold">1915</strong>
            </a>
          </div>
        </div>

        {/* 3 Main Footer Columns - Compact Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 py-3.5">
          
          {/* Column 1: Platform */}
          <div id="footer-col-platform">
            <h3 className="font-bold text-[11px] tracking-wider uppercase text-sky-400 font-mono mb-2">
              {language === 'en' ? 'Platform' : 'मंच'}
            </h3>
            <ul className="space-y-1 text-xs">
              {FOOTER_PLATFORM_LINKS.map((link) => {
                const isHome = link.actionKey === 'home';
                return (
                  <li key={link.actionKey}>
                    <button
                      id={`footer-link-${link.actionKey}`}
                      onClick={() => {
                        if (isHome) {
                          scrollToTop();
                        } else {
                          onActionClick(
                            link.actionKey,
                            language === 'en' ? link.label : link.labelHi,
                            link
                          );
                        }
                      }}
                      className="text-slate-300 hover:text-sky-300 transition-colors text-left flex items-center gap-1.5 py-0.5 group cursor-pointer w-full"
                    >
                      <span className="group-hover:translate-x-0.5 transition-transform truncate">
                        {language === 'en' ? link.label : link.labelHi}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Column 2: Rights & Topics */}
          <div id="footer-col-rights">
            <h3 className="font-bold text-[11px] tracking-wider uppercase text-sky-400 font-mono mb-2">
              {language === 'en' ? 'Rights & Topics' : 'अधिकार व विषय'}
            </h3>
            <ul className="space-y-1 text-xs">
              {FOOTER_RIGHTS_LINKS.map((link) => (
                <li key={link.actionKey}>
                  <button
                    id={`footer-link-${link.actionKey}`}
                    onClick={() =>
                      onActionClick(
                        link.actionKey,
                        language === 'en' ? link.label : link.labelHi,
                        link
                      )
                    }
                    className="text-slate-300 hover:text-sky-300 transition-colors text-left flex items-center gap-1.5 py-0.5 group cursor-pointer w-full"
                  >
                    <span className="group-hover:translate-x-0.5 transition-transform truncate">
                      {language === 'en' ? link.label : link.labelHi}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Govt Portals */}
          <div id="footer-col-govt">
            <h3 className="font-bold text-[11px] tracking-wider uppercase text-sky-400 font-mono mb-2">
              {language === 'en' ? 'Govt Portals' : 'सरकारी पोर्टल'}
            </h3>
            <ul className="space-y-1 text-xs">
              {FOOTER_GOVT_LINKS.map((link) => (
                <li key={link.actionKey}>
                  <button
                    id={`footer-link-${link.actionKey}`}
                    onClick={() =>
                      onActionClick(
                        link.actionKey,
                        language === 'en' ? link.label : link.labelHi,
                        link
                      )
                    }
                    className="text-slate-300 hover:text-sky-300 transition-colors text-left flex items-center justify-between gap-1.5 py-0.5 group cursor-pointer w-full"
                  >
                    <span className="group-hover:translate-x-0.5 transition-transform truncate">
                      {language === 'en' ? link.label : link.labelHi}
                    </span>
                    <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 text-sky-400 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom Legal Disclaimer & Copyright */}
        <div className="pt-3 border-t border-white/10 text-[11px] text-slate-400 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-center md:text-left">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight">
              {language === 'en'
                ? 'Nyaay Sarthi is an informational & legal assistance gateway. Not a solicitation under Bar Council Rules.'
                : 'न्याय सारथी एक सूचना व कानूनी मार्गदर्शन मंच है। यह बार काउंसिल नियमों के तहत विज्ञापन या वकालत आमंत्रण नहीं है।'}
            </p>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap text-center">
            <span>© {new Date().getFullYear()} Nyaay Sarthi. All rights reserved.</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
