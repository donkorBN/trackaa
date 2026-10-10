<?php

return [
    // "code": every new account needs a single-use access code (sold or handed out by an admin).
    // "open": anyone can sign up.
    'signup' => env('SIGNUP_MODE', 'code'),

    // Where people buy an access code (a Paystack payment page, WhatsApp link, etc.).
    'buy_url' => env('BUY_URL'),

    // Shown next to the buy button, e.g. "GH₵ 50, one-time".
    'price_label' => env('PRICE_LABEL'),

    // Comma-separated emails that can open the admin screen and create codes.
    'admin_emails' => array_values(array_filter(array_map(
        fn ($e) => strtolower(trim($e)),
        explode(',', (string) env('ADMIN_EMAILS', '')),
    ))),
];
