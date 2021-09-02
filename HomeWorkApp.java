package space1;

public class HomeWorkApp {
    public static void main(String[] args) {
        printThreeWords();
        checkSumSign();
        printColor();
        compareNumbers();
    }
    public static void printThreeWords() {
        System.out.println("№ 2 printThreeWords");
        System.out.println("Orange");
        System.out.println("Banana");
        System.out.println("Apple");
    }
    public static void checkSumSign() {
        System.out.println ("№ 3 checkSumSign");
        int a = 10;
        int b = -20;
        int c = a + b;
        if (c>=0) System.out.println("Сумма положительная");
        else System.out.println("Сумма отрицательная");
    }
    public static void printColor() {
        System.out.println ("№ 4 printColor");
        int value = 40;
        if (value<=0) System.out.println("Красный");
        else if (value>0 && value<=100) System.out.println("Желтый");
        else System.out.println("Зеленый");
    }
    public static void compareNumbers() {
        System.out.println("№ 5 compareNumbers");
        int a = 50;
        int b = 2;
        if (a>=b) System.out.println("a>=b");
        else System.out.println("a<b");
    }
}

