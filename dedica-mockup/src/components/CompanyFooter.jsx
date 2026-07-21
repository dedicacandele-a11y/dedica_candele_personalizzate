import { useEffect, useState } from "react";
import { EMPTY_BUSINESS_SETTINGS, getBusinessSettings } from "../services/businessSettings.js";

export function CompanyFooter({ onNavigate }) {
  const [company, setCompany] = useState(EMPTY_BUSINESS_SETTINGS);
  useEffect(() => { getBusinessSettings().then(setCompany).catch(() => {}); }, []);
  const location = [company.address, [company.postalCode, company.city].filter(Boolean).join(" "), company.province, company.country].filter(Boolean).join(", ");
  return <footer className="home-react-footer company-footer">
    <div><strong>DÈDICA</strong>{company.businessName ? <span>{company.businessName}</span> : null}</div>
    {company.businessName ? <div className="company-footer-data">
      {location ? <span>{location}</span> : null}
      <span>{[company.vatNumber ? `P. IVA ${company.vatNumber}` : "", company.taxCode ? `C.F. ${company.taxCode}` : "", company.rea ? `REA ${company.rea}` : ""].filter(Boolean).join(" · ")}</span>
      {company.email || company.phone || company.pec ? <span>{[company.email, company.phone, company.pec ? `PEC ${company.pec}` : ""].filter(Boolean).join(" · ")}</span> : null}
    </div> : null}
    <nav><button onClick={() => onNavigate("assistenza")}>Assistenza</button><button onClick={() => onNavigate("spedizioni-resi")}>Resi, garanzia e danni</button><button onClick={() => onNavigate("privacy")}>Privacy</button><button onClick={() => onNavigate("termini")}>Termini</button></nav>
  </footer>;
}
