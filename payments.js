// Pluggable online-payment hook. Disabled until PAYMENT_PROVIDER (paymob|stripe) and its keys are set in .env.
// To enable: implement createCheckout (return {url}) and verifyWebhook (return {customer_id,amount,ref} or null) for the chosen provider.
const P=()=>process.env.PAYMENT_PROVIDER;
module.exports={
  enabled:()=>!!P()&&!!(process.env.PAYMOB_API_KEY||process.env.STRIPE_SECRET_KEY),
  async createCheckout({customer,amount}){
    if(P()==='stripe'){/* TODO: stripe.checkout.sessions.create({...metadata:{customer_id:customer.id}}) */}
    if(P()==='paymob'){/* TODO: Paymob intention API -> payment URL */}
    throw new Error('Payment provider not implemented yet');
  },
  verifyWebhook(req){ return null; /* TODO: verify provider signature (Stripe-Signature / Paymob HMAC) */ }
};
