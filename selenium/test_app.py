"""End-to-end walkthrough for the RentWheels Pakistan demo."""
import os
import random
import unittest
from datetime import date, timedelta

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


BASE_URL = os.getenv("BASE_URL", "http://localhost:8080").rstrip("/")
REMOTE_URL = os.getenv("SELENIUM_REMOTE_URL")
HEADLESS = os.getenv("HEADLESS", "true").lower() not in ("0", "false", "no")


class RentWheelsJourney(unittest.TestCase):
    def setUp(self):
        options = Options()
        if HEADLESS:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1440,1000")
        self.driver = (webdriver.Remote(command_executor=REMOTE_URL, options=options)
                       if REMOTE_URL else webdriver.Chrome(options=options))
        self.wait = WebDriverWait(self.driver, 20)

    def tearDown(self):
        if hasattr(self, "driver"):
            self.driver.quit()

    def test_browse_book_and_lookup(self):
        driver = self.driver
        driver.get(BASE_URL)
        self.wait.until(EC.visibility_of_element_located((By.TAG_NAME, "h1")))
        self.assertIn("RentWheels", driver.title)
        self.assertTrue(driver.find_elements(By.CSS_SELECTOR, '[data-testid="car-card"]'))

        driver.get(f"{BASE_URL}/cars")
        card = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="car-card"]')))
        card.find_element(By.CSS_SELECTOR, '[data-testid="car-details-link"]').click()
        self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-testid="booking-form"]')))

        # Choose dates far enough ahead and vary the day to keep repeated demo runs independent.
        pickup = date.today() + timedelta(days=45 + random.randint(0, 180))
        returned = pickup + timedelta(days=2)
        for selector, value in (("[data-testid='pickup-date']", pickup.isoformat()),
                                ("[data-testid='return-date']", returned.isoformat())):
            field = driver.find_element(By.CSS_SELECTOR, selector)
            field.clear()
            field.send_keys(value)
        driver.find_element(By.CSS_SELECTOR, '[data-testid="customer-name"]').send_keys("Demo Traveller")
        driver.find_element(By.CSS_SELECTOR, '[data-testid="customer-phone"]').send_keys("03001234567")
        driver.find_element(By.CSS_SELECTOR, '[data-testid="submit-booking"]').click()

        reference = self.wait.until(EC.visibility_of_element_located(
            (By.CSS_SELECTOR, '[data-testid="booking-reference"]'))).text
        self.assertRegex(reference, r"^RW-[A-F0-9]{12}$")
        self.assertIn("DEMO BOOKING SUBMITTED", driver.page_source)

        driver.get(f"{BASE_URL}/my-booking")
        input_box = self.wait.until(EC.visibility_of_element_located(
            (By.CSS_SELECTOR, '[data-testid="booking-reference-input"]')))
        input_box.send_keys(reference)
        driver.find_element(By.XPATH, "//button[contains(., 'Find booking')]").click()
        found = self.wait.until(EC.visibility_of_element_located(
            (By.CSS_SELECTOR, '[data-testid="booking-summary"]')))
        self.assertIn(reference, found.text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
