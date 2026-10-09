<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * A [start, end) time range expressed in UTC, built from calendar dates in the
 * user's timezone. Transactions belong to a period by their occurred_at.
 */
final class Period
{
    public function __construct(
        public readonly CarbonImmutable $start,
        public readonly CarbonImmutable $end,
        public readonly string $tz,
    ) {}

    public static function today(string $tz): self
    {
        $now = CarbonImmutable::now($tz);

        return self::local($now->startOfDay(), $now->startOfDay()->addDay(), $tz);
    }

    public static function week(string $tz): self
    {
        $start = CarbonImmutable::now($tz)->startOfWeek(CarbonImmutable::MONDAY);

        return self::local($start, $start->addWeek(), $tz);
    }

    public static function month(string $tz): self
    {
        $start = CarbonImmutable::now($tz)->startOfMonth();

        return self::local($start, $start->addMonth(), $tz);
    }

    /** Inclusive calendar dates (Y-m-d) in $tz. Either side may be open. */
    public static function dates(?string $from, ?string $to, string $tz): self
    {
        try {
            $start = $from ? CarbonImmutable::createFromFormat('!Y-m-d', $from, $tz) : CarbonImmutable::create(1970, 1, 1, 0, 0, 0, $tz);
            $end = $to ? CarbonImmutable::createFromFormat('!Y-m-d', $to, $tz)->addDay() : CarbonImmutable::create(9999, 1, 1, 0, 0, 0, $tz);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['from' => 'Dates must be in YYYY-MM-DD format.']);
        }
        if ($end <= $start) {
            throw ValidationException::withMessages(['to' => 'The end date must be on or after the start date.']);
        }

        return self::local($start, $end, $tz);
    }

    public static function named(string $name, ?string $from, ?string $to, string $tz): self
    {
        return match ($name) {
            'today' => self::today($tz),
            'week' => self::week($tz),
            'custom' => self::dates($from, $to, $tz),
            default => self::month($tz),
        };
    }

    private static function local(CarbonImmutable $start, CarbonImmutable $end, string $tz): self
    {
        return new self($start->utc(), $end->utc(), $tz);
    }

    /** Inclusive local dates for display. */
    public function toArray(): array
    {
        return [
            'from' => $this->start->setTimezone($this->tz)->toDateString(),
            'to' => $this->end->setTimezone($this->tz)->subDay()->toDateString(),
        ];
    }

    public static function timezone(?string $requested, string $fallback): string
    {
        return $requested && in_array($requested, \DateTimeZone::listIdentifiers(), true) ? $requested : $fallback;
    }
}
