import unittest
import requests

class APITestCase(unittest.TestCase):
    # Adjust the base URL as needed
    BASE_URL = "http://localhost:8000"

    def test_stock_data_api(self):
        """Test the stock_data_api GET endpoint."""
        url = f"{self.BASE_URL}/api/stockdata/"
        response = requests.get(url)
        # Ensure we get an HTTP 200 OK response
        self.assertEqual(response.status_code, 200, msg="Expected status code 200")
        
        data = response.json()
        # Check that the response contains the required keys
        self.assertIn("status_code", data)
        self.assertEqual(data["status_code"], 200)
        self.assertIn("time_series", data)
        self.assertIn("fin_data", data)

        # Optionally, check one time_series item structure if available
        if data["time_series"]:
            item = data["time_series"][0]
            self.assertIn("time", item)
            self.assertIn("close_price", item)
            self.assertIn("volume", item)
            # Verify time format "YYYY-MM-DD"
            self.assertRegex(item["time"], r"\d{4}-\d{2}-\d{2}")

    def test_unusual_ranges_api(self):
        """Test the unusual_ranges_api POST endpoint."""
        url = f"{self.BASE_URL}/api/unusual_range/"
        # Create sample input data. Adjust the dates and values as needed.
        input_payload = {
            "data": {
                "2025-01-01": [0.05],
                "2025-01-02": [0.02],
                "2025-01-03": [0.10],
                "2025-01-04": [0.03],
                "2025-01-05": [-0.04],
                "2025-01-06": [0.01],
                "2025-01-07": [0.07],
            }
        }
        response = requests.post(url, json=input_payload)
        print(response)
        # Ensure we get an HTTP 200 OK response
        self.assertEqual(response.status_code, 200, msg="Expected status code 200")
        
        data = response.json()
        self.assertIn("status_code", data)
        self.assertEqual(data["status_code"], 200)
        self.assertIn("unusual_ranges", data)
        self.assertIsInstance(data["unusual_ranges"], list)

if __name__ == "__main__":
    unittest.main()