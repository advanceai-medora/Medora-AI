import os
import time
from datetime import datetime
import stripe
from flask import current_app

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

def create_subscription_with_trial(email, stripe_token, trial_days=30):
    """
    Create a Stripe subscription with a trial period.
    The user will not be charged during the trial period.
    """
    try:
        # Step 1: Create a customer in Stripe
        customer = stripe.Customer.create(
            email=email,
            source=stripe_token
        )

        # Step 2: Create a subscription with a trial period
        trial_end_timestamp = int(time.time()) + trial_days * 24 * 3600
        subscription = stripe.Subscription.create(
            customer=customer.id,
            items=[
                {
                    'price': os.getenv('STRIPE_PRICE_ID')
                }
            ],
            collection_method='charge_automatically',
            trial_end=trial_end_timestamp
            #trial_period_days=trial_days  # Set the trial period
        )

        return {
            'success': True,
            'subscription_id': subscription.id,
            'customer_id': customer.id,
            'trial_end': datetime.fromtimestamp(subscription.trial_end).strftime('%Y-%m-%d')
        }
    except stripe.error.StripeError as e:
        current_app.logger.error(f"Stripe error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def get_stripe_subscriptions():
    """Fetch all Stripe subscriptions and their customer info."""
    try:
        subscriptions = []
        starting_after = None
        while True:
            response = stripe.Subscription.list(limit=100, starting_after=starting_after)
            for sub in response['data']:
                customer = stripe.Customer.retrieve(sub['customer'])
                subscriptions.append({
                    'subscription_id': sub['id'],
                    'status': sub['status'],
                    'plan': sub['items']['data'][0]['plan']['nickname'] if sub['items']['data'] else 'N/A',
                    'email': customer['email'],
                    'customer_id': customer['id']
                })
            if not response['has_more']:
                break
            starting_after = response['data'][-1]['id']
        return {'success': True, 'subscriptions': subscriptions}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def get_stripe_transactions(limit=20):
    """
    Fetch recent Stripe charge transactions.
    """
    try:
        charges = stripe.Charge.list(limit=limit)
        transactions = []
        for charge in charges['data']:
            customer_email = None
            if charge.get('customer'):
                try:
                    customer = stripe.Customer.retrieve(charge['customer'])
                    customer_email = customer.get('email')
                except Exception:
                    customer_email = None
            transactions.append({
                'id': charge['id'],
                'amount': charge['amount'] / 100,
                'currency': charge['currency'],
                'status': charge['status'],
                'created': charge['created'],
                'customer_email': customer_email,
                'receipt_url': charge.get('receipt_url', ''),
            })
        return {'success': True, 'transactions': transactions}
    except Exception as e:
        return {'success': False, 'error': str(e)}, 500
