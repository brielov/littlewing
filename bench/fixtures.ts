/**
 * Standard benchmark fixtures for performance testing
 *
 * These fixtures represent three levels of script complexity:
 * - Small: ~5-10 lines, simple arithmetic
 * - Medium: ~30-50 lines, realistic use case with functions and conditionals
 * - Large: ~150-200 lines, complex business logic
 *
 * All benchmarks use the same fixtures to ensure consistent comparison
 * across different optimization approaches and script sizes.
 */

/**
 * Small script: Simple calculations with a few variables
 * ~8 lines, basic arithmetic and assignments
 */
export const SMALL_SCRIPT = `
x = 10
y = 20
z = x + y
result = z * 2
discount = result * 0.1
final = result - discount
final
`

/**
 * Medium script: Realistic business logic with functions, conditionals, and date operations
 * ~40 lines, typical use case
 */
export const MEDIUM_SCRIPT = `
// Invoice calculation with date-based discounts
principal = 1000
rate = 0.05
years = 3

// Calculate compound interest
interest = principal * ((1 + rate) ^ years - 1)
total = principal + interest

// Apply early payment discount based on date
today = TODAY()
dueDate = ADD_DAYS(today, 30)
paymentDate = ADD_DAYS(today, 15)

// Calculate discount
earlyDiscount = if paymentDate < dueDate then total * 0.02 else 0
discountedTotal = total - earlyDiscount

// Apply tax calculation
taxRate = 0.15
tax = discountedTotal * taxRate
finalAmount = discountedTotal + tax

// Calculate monthly payment
months = years * 12
monthlyPayment = finalAmount / months

// Business day adjustment
weekday = GET_WEEKDAY(paymentDate)
businessDayAdjustment = if IS_WEEKEND(paymentDate) then 2 else 0
adjustedPaymentDate = ADD_DAYS(paymentDate, businessDayAdjustment)

// Final result
result = monthlyPayment
result
`

/**
 * Large script: Complex business logic with many variables, nested expressions, and functions
 * ~180 lines, stress test for parser and optimizer
 */
export const LARGE_SCRIPT = `
// Complex financial calculator with multiple scenarios

// Base configuration
baseAmount = 10000
interestRate = 0.065
term = 5

// Scenario 1: Standard compound interest
scenario1Principal = baseAmount
scenario1Rate = interestRate
scenario1Years = term
scenario1Amount = scenario1Principal * ((1 + scenario1Rate) ^ scenario1Years)

// Scenario 2: Monthly compounding
scenario2Principal = baseAmount
scenario2Rate = interestRate / 12
scenario2Periods = term * 12
scenario2Amount = scenario2Principal * ((1 + scenario2Rate) ^ scenario2Periods)

// Scenario 3: Daily compounding
scenario3Principal = baseAmount
scenario3Rate = interestRate / 365
scenario3Days = term * 365
scenario3Amount = scenario3Principal * ((1 + scenario3Rate) ^ scenario3Days)

// Date-based calculations
startDate = TODAY()
endDate = ADD_YEARS(startDate, term)
totalDays = DIFFERENCE_IN_DAYS(endDate, startDate)
totalMonths = DIFFERENCE_IN_MONTHS(endDate, startDate)

// Payment schedule calculations
paymentFrequency = 12
numberOfPayments = term * paymentFrequency
paymentAmount = scenario2Amount / numberOfPayments

// Early payment analysis
monthlyPayment = paymentAmount
earlyPaymentMonth = 24
earlyPaymentDiscount = 0.03
regularPayments = earlyPaymentMonth * monthlyPayment
remainingPayments = (numberOfPayments - earlyPaymentMonth) * monthlyPayment
discountAmount = remainingPayments * earlyPaymentDiscount
earlyPaymentTotal = regularPayments + (remainingPayments - discountAmount)

// Fee calculations
processingFee = baseAmount * 0.01
maintenanceFee = 50
annualFees = maintenanceFee * term
totalFees = processingFee + annualFees

// Tax calculations
federalTaxRate = 0.22
stateTaxRate = 0.06
localTaxRate = 0.02
combinedTaxRate = federalTaxRate + stateTaxRate + localTaxRate

// Apply taxes to different scenarios
scenario1Tax = (scenario1Amount - scenario1Principal) * combinedTaxRate
scenario2Tax = (scenario2Amount - scenario2Principal) * combinedTaxRate
scenario3Tax = (scenario3Amount - scenario3Principal) * combinedTaxRate

scenario1AfterTax = scenario1Amount - scenario1Tax
scenario2AfterTax = scenario2Amount - scenario2Tax
scenario3AfterTax = scenario3Amount - scenario3Tax

// Risk adjustments
lowRiskFactor = 0.95
mediumRiskFactor = 0.85
highRiskFactor = 0.70

scenario1LowRisk = scenario1AfterTax * lowRiskFactor
scenario1MediumRisk = scenario1AfterTax * mediumRiskFactor
scenario1HighRisk = scenario1AfterTax * highRiskFactor

scenario2LowRisk = scenario2AfterTax * lowRiskFactor
scenario2MediumRisk = scenario2AfterTax * mediumRiskFactor
scenario2HighRisk = scenario2AfterTax * highRiskFactor

scenario3LowRisk = scenario3AfterTax * lowRiskFactor
scenario3MediumRisk = scenario3AfterTax * mediumRiskFactor
scenario3HighRisk = scenario3AfterTax * highRiskFactor

// Calculate weighted averages
lowRiskWeight = 0.6
mediumRiskWeight = 0.3
highRiskWeight = 0.1

scenario1Weighted = (scenario1LowRisk * lowRiskWeight) + (scenario1MediumRisk * mediumRiskWeight) + (scenario1HighRisk * highRiskWeight)
scenario2Weighted = (scenario2LowRisk * lowRiskWeight) + (scenario2MediumRisk * mediumRiskWeight) + (scenario2HighRisk * highRiskWeight)
scenario3Weighted = (scenario3LowRisk * lowRiskWeight) + (scenario3MediumRisk * mediumRiskWeight) + (scenario3HighRisk * highRiskWeight)

// Best scenario analysis
bestScenario = MAX(scenario1Weighted, scenario2Weighted, scenario3Weighted)
worstScenario = MIN(scenario1Weighted, scenario2Weighted, scenario3Weighted)
scenarioRange = bestScenario - worstScenario
averageScenario = (scenario1Weighted + scenario2Weighted + scenario3Weighted) / 3

// Inflation adjustment
inflationRate = 0.025
inflationFactor = ((1 + inflationRate) ^ term)
inflationAdjustedBest = bestScenario / inflationFactor
inflationAdjustedWorst = worstScenario / inflationFactor
inflationAdjustedAverage = averageScenario / inflationFactor

// ROI calculations
scenario1ROI = ((scenario1Weighted - baseAmount) / baseAmount) * 100
scenario2ROI = ((scenario2Weighted - baseAmount) / baseAmount) * 100
scenario3ROI = ((scenario3Weighted - baseAmount) / baseAmount) * 100
averageROI = (scenario1ROI + scenario2ROI + scenario3ROI) / 3

// Annualized returns
scenario1Annualized = ((scenario1Weighted / baseAmount) ^ (1 / term) - 1) * 100
scenario2Annualized = ((scenario2Weighted / baseAmount) ^ (1 / term) - 1) * 100
scenario3Annualized = ((scenario3Weighted / baseAmount) ^ (1 / term) - 1) * 100

// Break-even analysis
breakEvenYears = term / 2
breakEvenAmount = baseAmount * ((1 + interestRate) ^ breakEvenYears)
breakEvenDifference = breakEvenAmount - baseAmount

// Quarterly analysis
quartersInTerm = term * 4
quarterlyRate = interestRate / 4
quarterlyAmount = baseAmount * ((1 + quarterlyRate) ^ quartersInTerm)
quarterlyPayment = quarterlyAmount / quartersInTerm

// Date milestones
quarter1Date = ADD_MONTHS(startDate, 3)
quarter2Date = ADD_MONTHS(startDate, 6)
quarter3Date = ADD_MONTHS(startDate, 9)
year1Date = ADD_YEARS(startDate, 1)
year2Date = ADD_YEARS(startDate, 2)
year3Date = ADD_YEARS(startDate, 3)
year4Date = ADD_YEARS(startDate, 4)

// Milestone values
year1Value = baseAmount * ((1 + interestRate) ^ 1)
year2Value = baseAmount * ((1 + interestRate) ^ 2)
year3Value = baseAmount * ((1 + interestRate) ^ 3)
year4Value = baseAmount * ((1 + interestRate) ^ 4)
year5Value = baseAmount * ((1 + interestRate) ^ 5)

// Growth analysis
year1Growth = year1Value - baseAmount
year2Growth = year2Value - year1Value
year3Growth = year3Value - year2Value
year4Growth = year4Value - year3Value
year5Growth = year5Value - year4Value

totalGrowth = year5Value - baseAmount
averageYearlyGrowth = totalGrowth / term

// Final recommendation score (0-100)
roiScore = CLAMP(averageROI, 0, 100)
riskScore = CLAMP((lowRiskWeight * 100), 0, 100)
liquidityScore = CLAMP((1 / term) * 100, 0, 100)
finalScore = (roiScore * 0.5) + (riskScore * 0.3) + (liquidityScore * 0.2)

// Return the final recommendation score
finalScore
`
