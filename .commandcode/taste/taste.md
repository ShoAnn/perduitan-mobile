# Taste

## Architecture & navigation

- Prefers inline editing (within the existing list/manage screen) over adding a separate edit route/screen. Confidence: 0.6

## Debugging & workflow

- Wants debug output (e.g. logging the parsed result) gated behind an environment testing flag rather than an unconditional `console.log`. Confidence: 0.6

## Product & domain behavior

- When deriving an expense/income description from a receipt, wants the payment app/service name retained and combined with the merchant, formatted as `Service - Merchant` (e.g. `Gopay - Warteg Pesona 21`). Confidence: 0.6

## UI & styling

- Prefers smooth fading/transitional animations over abrupt ("blocky") hard state changes for UI highlight effects. Confidence: 0.6
- Prefers such highlight/feedback animations kept brief (a few hundred ms total) rather than lingering. Confidence: 0.5
