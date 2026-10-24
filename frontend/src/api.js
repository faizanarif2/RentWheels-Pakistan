const API='/api';
async function request(path,options={}){
  const response=await fetch(`${API}${path}`,{headers:{'Content-Type':'application/json',...options.headers},...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||'We could not complete that request. Please try again.');
  return data;
}
export const api={cars:(query='')=>request(`/cars${query}`),car:id=>request(`/cars/${id}`),book:body=>request('/bookings',{method:'POST',body:JSON.stringify(body)}),booking:ref=>request(`/bookings/${encodeURIComponent(ref)}`)};
export const money=value=>{try{return new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR',maximumFractionDigits:0}).format(Number(value))}catch{return `PKR ${Number(value).toLocaleString('en-PK')}`}};
